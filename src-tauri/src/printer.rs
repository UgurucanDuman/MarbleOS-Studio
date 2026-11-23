use crate::snapshot;
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{ImageFormat, ImageReader, Limits, RgbImage};
use serde::{Deserialize, Serialize};
use std::io::Cursor;

const MAX_PRINT_TOTAL_BYTES: usize = 96 * 1024 * 1024;
const MAX_PAGE_B64_LEN: usize = 36 * 1024 * 1024;
const MAX_PRINT_PIXEL_EDGE: u32 = 8_192;
const FALLBACK_BAND_ROWS: u32 = 512;
const PRINT_SPOOL_ERROR: &str = "Yazıcı kuyruğuna gönderim tamamlanamadı. Yazıcı bağlantısını kontrol edin.";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemPrinterInfo {
    pub name: String,
    pub is_default: bool,
    pub is_offline: bool,
    pub is_network: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrintPagePayload {
    pub jpeg_base64: String,
    pub width_mm: f64,
    pub height_mm: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectPrintRequest {
    pub printer_name: String,
    pub job_title: String,
    pub copies: u16,
    pub orientation: String,
    pub duplex: String,
    pub scale_mode: String,
    pub pages: Vec<PrintPagePayload>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintedJobReceipt {
    pub printer_name: String,
    pub spooled_pages: usize,
    pub copies: u16,
}

struct ValidatedPrintPage {
    jpeg_bytes: Vec<u8>,
    width_mm: f64,
    height_mm: f64,
}

fn clean_single_line(raw: &str, max_utf16: usize) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty()
        || trimmed.encode_utf16().count() > max_utf16
        || trimmed.chars().any(|c| c.is_control())
    {
        return None;
    }
    Some(trimmed.to_owned())
}

fn decode_rgb_bounded(jpeg_bytes: &[u8]) -> Result<RgbImage, &'static str> {
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_PRINT_PIXEL_EDGE);
    limits.max_image_height = Some(MAX_PRINT_PIXEL_EDGE);
    limits.max_alloc = Some(128 * 1024 * 1024);

    let mut reader = ImageReader::with_format(Cursor::new(jpeg_bytes), ImageFormat::Jpeg);
    reader.limits(limits);
    let decoded = reader.decode().map_err(|_| snapshot::INVALID_DATA)?;
    let rgb = decoded.into_rgb8();
    if rgb.width() == 0 || rgb.height() == 0 {
        return Err(snapshot::INVALID_DATA);
    }
    Ok(rgb)
}

fn validate_jpeg_page(payload: &PrintPagePayload, used_bytes: &mut usize) -> Result<ValidatedPrintPage, &'static str> {
    if !payload.width_mm.is_finite()
        || !payload.height_mm.is_finite()
        || !(30.0..=500.0).contains(&payload.width_mm)
        || !(30.0..=500.0).contains(&payload.height_mm)
    {
        return Err(snapshot::INVALID_DATA);
    }
    let trimmed = payload.jpeg_base64.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_PAGE_B64_LEN {
        return Err(snapshot::INVALID_DATA);
    }
    let bytes = STANDARD.decode(trimmed).map_err(|_| snapshot::INVALID_DATA)?;
    if bytes.len() < 4 || !bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Err(snapshot::INVALID_DATA);
    }
    *used_bytes = used_bytes.saturating_add(bytes.len());
    if *used_bytes > MAX_PRINT_TOTAL_BYTES {
        return Err("Yazdırma işi 96 MB bellek sınırını aşıyor.");
    }
    // Kuyruk başlatılmadan önce her sayfanın bozuk olmadığını doğrula; piksel belleği hemen serbest bırakılır.
    let _ = decode_rgb_bounded(&bytes)?;
    Ok(ValidatedPrintPage {
        jpeg_bytes: bytes,
        width_mm: payload.width_mm,
        height_mm: payload.height_mm,
    })
}

/// 24-bit Windows GDI DIB satır uzunluğu (her satır 4 bayt DWORD hizalıdır).
fn bgr24_row_stride(width: u32) -> usize {
    ((width as usize) * 3 + 3) & !3
}

/// Eski ve yeni tüm Windows yazıcı sürücüleriyle %100 uyumlu 24-bit bottom-up BGR DIB oluşturur.
fn pack_rgb_band_to_bottom_up_bgr24(rgb: &RgbImage, sy0: u32, sy1: u32, out: &mut Vec<u8>) {
    let width = rgb.width() as usize;
    let row_bytes = width * 3;
    let stride = bgr24_row_stride(rgb.width());
    let pad = stride - row_bytes;
    let rows = (sy1 - sy0) as usize;
    let raw = rgb.as_raw();

    out.clear();
    out.reserve(stride * rows);
    for y in (sy0..sy1).rev() {
        let row_start = (y as usize) * row_bytes;
        let row_slice = &raw[row_start..row_start + row_bytes];
        for px in row_slice.chunks_exact(3) {
            out.push(px[2]);
            out.push(px[1]);
            out.push(px[0]);
        }
        for _ in 0..pad {
            out.push(0);
        }
    }
}

/// Gerçek fiziksel piksel/metre yoğunluğunu hesaplar (300 DPI ≈ 11_811 pels/m).
fn pels_per_meter(pixels: u32, mm: f64) -> i32 {
    ((f64::from(pixels) / (mm.max(1.0) / 1000.0)).round() as i32).clamp(2_835, 94_488)
}

/// Sürücü DM_ORIENTATION ayarını yok sayıp dikey/yatay ters DC açtıysa sayfanın kırpılmasını önler.
fn should_auto_rotate_page(
    width_mm: f64,
    height_mm: f64,
    phys_w: i32,
    phys_h: i32,
    dpi_x: i32,
    dpi_y: i32,
    fit_page: bool,
) -> bool {
    if (width_mm - height_mm).abs() <= 2.0 || (phys_w - phys_h).abs() <= 8 {
        return false;
    }
    let page_landscape = width_mm > height_mm;
    let dc_landscape = phys_w > phys_h;
    if page_landscape == dc_landscape {
        return false;
    }
    let exact_w = (width_mm / 25.4) * f64::from(dpi_x);
    let exact_h = (height_mm / 25.4) * f64::from(dpi_y);
    fit_page || exact_w > f64::from(phys_w) + 2.0 || exact_h > f64::from(phys_h) + 2.0
}

#[allow(clippy::too_many_arguments)]
fn compute_page_dest_rect(
    width_mm: f64,
    height_mm: f64,
    dpi_x: i32,
    dpi_y: i32,
    horz_res: i32,
    vert_res: i32,
    phys_w: i32,
    phys_h: i32,
    offset_x: i32,
    offset_y: i32,
    fit_page: bool,
) -> (i32, i32, i32, i32) {
    let exact_w = ((width_mm / 25.4) * f64::from(dpi_x)).round().max(1.0);
    let exact_h = ((height_mm / 25.4) * f64::from(dpi_y)).round().max(1.0);
    if fit_page {
        let scale = (f64::from(horz_res) / exact_w).min(f64::from(vert_res) / exact_h);
        let w = (exact_w * scale).round().max(1.0) as i32;
        let h = (exact_h * scale).round().max(1.0) as i32;
        ((horz_res - w) / 2, (vert_res - h) / 2, w, h)
    } else {
        let w = exact_w as i32;
        let h = exact_h as i32;
        (((phys_w - w) / 2) - offset_x, ((phys_h - h) / 2) - offset_y, w, h)
    }
}

fn compute_band_dest_span(sy0: u32, sy1: u32, src_h: u32, dest_y: i32, dest_h: i32) -> (i32, i32) {
    let y0 = dest_y + ((f64::from(sy0) / f64::from(src_h)) * f64::from(dest_h)).round() as i32;
    let y1 = dest_y + ((f64::from(sy1) / f64::from(src_h)) * f64::from(dest_h)).round() as i32;
    (y0, (y1 - y0).max(1))
}

pub fn list_system_printers() -> Result<Vec<SystemPrinterInfo>, &'static str> {
    #[cfg(windows)]
    {
        win32_print::enum_printers()
    }
    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

pub fn execute_direct_print(job: DirectPrintRequest) -> Result<PrintedJobReceipt, &'static str> {
    if !(1..=99).contains(&job.copies) || !(1..=120).contains(&job.pages.len()) {
        return Err(snapshot::INVALID_DATA);
    }
    let landscape = match job.orientation.as_str() {
        "portrait" => false,
        "landscape" => true,
        _ => return Err(snapshot::INVALID_DATA),
    };
    let duplex_code: i16 = match job.duplex.as_str() {
        "simplex" => 1,
        "vertical" => 2,
        "horizontal" => 3,
        _ => return Err(snapshot::INVALID_DATA),
    };
    let fit_page = match job.scale_mode.as_str() {
        "actual-100" => false,
        "fit-page" => true,
        _ => return Err(snapshot::INVALID_DATA),
    };
    let printer_name = clean_single_line(&job.printer_name, 220).ok_or(snapshot::INVALID_DATA)?;
    let job_title = clean_single_line(&job.job_title, 160)
        .unwrap_or_else(|| "MarbleOS Studio Baski".to_owned());

    let installed = list_system_printers()?;
    if !installed.iter().any(|p| p.name == printer_name) {
        return Err("Seçilen yazıcı Windows yazıcı listesinde bulunamadı.");
    }

    let mut total_bytes = 0usize;
    let mut pages = Vec::with_capacity(job.pages.len());
    for raw_page in &job.pages {
        pages.push(validate_jpeg_page(raw_page, &mut total_bytes)?);
    }

    #[cfg(windows)]
    {
        win32_print::spool_validated_pages(
            &printer_name,
            &job_title,
            job.copies,
            landscape,
            duplex_code,
            fit_page,
            &pages,
        )?;
        Ok(PrintedJobReceipt {
            printer_name,
            spooled_pages: pages.len() * usize::from(job.copies),
            copies: job.copies,
        })
    }
    #[cfg(not(windows))]
    {
        let _ = (landscape, duplex_code, fit_page, job_title);
        Err(PRINT_SPOOL_ERROR)
    }
}

#[cfg(windows)]
mod win32_print {
    use super::{
        compute_band_dest_span, compute_page_dest_rect, decode_rgb_bounded,
        pack_rgb_band_to_bottom_up_bgr24, pels_per_meter, should_auto_rotate_page,
        SystemPrinterInfo, ValidatedPrintPage, FALLBACK_BAND_ROWS, PRINT_SPOOL_ERROR,
    };
    use image::RgbImage;
    use std::{
        ffi::c_void,
        mem::size_of,
        ptr::{null, null_mut},
    };

    const PRINTER_ENUM_LOCAL: u32 = 0x0000_0002;
    const PRINTER_ENUM_CONNECTIONS: u32 = 0x0000_0004;
    const PRINTER_ATTRIBUTE_NETWORK: u32 = 0x0000_0010;
    const PRINTER_ATTRIBUTE_WORK_OFFLINE: u32 = 0x0000_0400;

    const DM_OUT_BUFFER: u32 = 2;
    const DM_IN_BUFFER: u32 = 8;
    const DM_ORIENTATION: u32 = 0x0000_0001;
    const DM_PAPERSIZE: u32 = 0x0000_0002;
    const DM_PAPERLENGTH: u32 = 0x0000_0004;
    const DM_PAPERWIDTH: u32 = 0x0000_0008;
    const DM_COPIES: u32 = 0x0000_0100;
    const DM_PRINTQUALITY: u32 = 0x0000_0400;
    const DM_COLOR: u32 = 0x0000_0800;
    const DM_DUPLEX: u32 = 0x0000_1000;
    const DMPAPER_A4: i16 = 9;
    const DMCOLOR_COLOR: i16 = 2;
    const DMRES_DRAFT: i16 = -1;
    const DMRES_LOW: i16 = -2;
    const DMRES_HIGH: i16 = -4;

    const HORZRES: i32 = 8;
    const VERTRES: i32 = 10;
    const LOGPIXELSX: i32 = 88;
    const LOGPIXELSY: i32 = 90;
    const PHYSICALWIDTH: i32 = 110;
    const PHYSICALHEIGHT: i32 = 111;
    const PHYSICALOFFSETX: i32 = 112;
    const PHYSICALOFFSETY: i32 = 113;
    const COLORONCOLOR: i32 = 3;
    const HALFTONE: i32 = 4;
    const SRCCOPY: u32 = 0x00CC_0020;

    #[repr(C)]
    struct PrinterInfo4W {
        p_printer_name: *mut u16,
        p_server_name: *mut u16,
        attributes: u32,
    }

    #[repr(C)]
    struct DevModePrefixW {
        dm_device_name: [u16; 32],
        dm_spec_version: u16,
        dm_driver_version: u16,
        dm_size: u16,
        dm_driver_extra: u16,
        dm_fields: u32,
        dm_orientation: i16,
        dm_paper_size: i16,
        dm_paper_length: i16,
        dm_paper_width: i16,
        dm_scale: i16,
        dm_copies: i16,
        dm_default_source: i16,
        dm_print_quality: i16,
        dm_color: i16,
        dm_duplex: i16,
    }

    #[repr(C)]
    struct DocInfoW {
        cb_size: i32,
        lpsz_doc_name: *const u16,
        lpsz_output: *const u16,
        lpsz_datatype: *const u16,
        fw_type: u32,
    }

    #[repr(C)]
    struct BitmapInfoHeader {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    #[link(name = "winspool")]
    extern "system" {
        fn GetDefaultPrinterW(psz_buffer: *mut u16, pcch_buffer: *mut u32) -> i32;
        fn EnumPrintersW(
            flags: u32,
            name: *mut u16,
            level: u32,
            p_printer_enum: *mut u8,
            cb_buf: u32,
            pcb_needed: *mut u32,
            pc_returned: *mut u32,
        ) -> i32;
        fn OpenPrinterW(
            p_printer_name: *mut u16,
            ph_printer: *mut *mut c_void,
            p_default: *const c_void,
        ) -> i32;
        fn ClosePrinter(h_printer: *mut c_void) -> i32;
        fn DocumentPropertiesW(
            h_wnd: *mut c_void,
            h_printer: *mut c_void,
            p_device_name: *mut u16,
            p_dev_mode_output: *mut c_void,
            p_dev_mode_input: *const c_void,
            f_mode: u32,
        ) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateDCW(
            pwsz_driver: *const u16,
            pwsz_device: *const u16,
            psz_port: *const u16,
            pdm: *const c_void,
        ) -> *mut c_void;
        fn DeleteDC(hdc: *mut c_void) -> i32;
        fn GetDeviceCaps(hdc: *mut c_void, index: i32) -> i32;
        fn SetStretchBltMode(hdc: *mut c_void, mode: i32) -> i32;
        fn SetBrushOrgEx(hdc: *mut c_void, x: i32, y: i32, lppt: *mut c_void) -> i32;
        fn StartDocW(hdc: *mut c_void, lpdi: *const DocInfoW) -> i32;
        fn EndDoc(hdc: *mut c_void) -> i32;
        fn AbortDoc(hdc: *mut c_void) -> i32;
        fn StartPage(hdc: *mut c_void) -> i32;
        fn EndPage(hdc: *mut c_void) -> i32;
        fn StretchDIBits(
            hdc: *mut c_void,
            x_dest: i32,
            y_dest: i32,
            dest_width: i32,
            dest_height: i32,
            x_src: i32,
            y_src: i32,
            src_width: i32,
            src_height: i32,
            lp_bits: *const c_void,
            lpbmi: *const BitmapInfoHeader,
            i_usage: u32,
            rop: u32,
        ) -> i32;
    }

    struct PrinterHandle(*mut c_void);
    impl Drop for PrinterHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    let _ = ClosePrinter(self.0);
                }
            }
        }
    }

    struct DeviceContextGuard(*mut c_void);
    impl Drop for DeviceContextGuard {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    let _ = DeleteDC(self.0);
                }
            }
        }
    }

    fn to_wide_z(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn wide_ptr_to_string(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0usize;
        while len < 512 && *ptr.add(len) != 0 {
            len += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
    }

    fn default_printer_name() -> Option<String> {
        unsafe {
            let mut chars: u32 = 0;
            let _ = GetDefaultPrinterW(null_mut(), &mut chars);
            if chars == 0 || chars > 512 {
                return None;
            }
            let mut buf = vec![0u16; chars as usize];
            if GetDefaultPrinterW(buf.as_mut_ptr(), &mut chars) == 0 {
                return None;
            }
            let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            let name = String::from_utf16_lossy(&buf[..end]).trim().to_owned();
            (!name.is_empty()).then_some(name)
        }
    }

    pub fn enum_printers() -> Result<Vec<SystemPrinterInfo>, &'static str> {
        let default_name = default_printer_name();
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        unsafe {
            let mut needed: u32 = 0;
            let mut returned: u32 = 0;
            let _ = EnumPrintersW(flags, null_mut(), 4, null_mut(), 0, &mut needed, &mut returned);
            if needed == 0 {
                return Ok(Vec::new());
            }
            if needed > 8 * 1024 * 1024 {
                return Err("Yazıcı listesi okunamadı.");
            }
            let mut aligned = vec![0u64; (needed as usize).div_ceil(8)];
            let ok = EnumPrintersW(
                flags,
                null_mut(),
                4,
                aligned.as_mut_ptr() as *mut u8,
                (aligned.len() * 8) as u32,
                &mut needed,
                &mut returned,
            );
            if ok == 0 {
                return Err("Windows yazıcı listesi alınamadı.");
            }

            let slice = std::slice::from_raw_parts(
                aligned.as_ptr() as *const PrinterInfo4W,
                returned as usize,
            );
            let mut list = Vec::with_capacity(slice.len());
            for item in slice {
                let name = wide_ptr_to_string(item.p_printer_name).trim().to_owned();
                if name.is_empty() {
                    continue;
                }
                let is_default = default_name
                    .as_deref()
                    .is_some_and(|def| def.eq_ignore_ascii_case(&name));
                list.push(SystemPrinterInfo {
                    name,
                    is_default,
                    is_offline: (item.attributes & PRINTER_ATTRIBUTE_WORK_OFFLINE) != 0,
                    is_network: (item.attributes & PRINTER_ATTRIBUTE_NETWORK) != 0,
                });
            }
            list.sort_by(|a, b| b.is_default.cmp(&a.is_default).then_with(|| a.name.cmp(&b.name)));
            Ok(list)
        }
    }

    fn build_driver_devmode(
        printer_w: &mut [u16],
        landscape: bool,
        effective_duplex: i16,
        is_a4: bool,
    ) -> Option<Vec<u64>> {
        unsafe {
            let mut raw_handle: *mut c_void = null_mut();
            if OpenPrinterW(printer_w.as_mut_ptr(), &mut raw_handle, null()) == 0 || raw_handle.is_null() {
                return None;
            }
            let handle = PrinterHandle(raw_handle);
            let bytes_needed = DocumentPropertiesW(
                null_mut(),
                handle.0,
                printer_w.as_mut_ptr(),
                null_mut(),
                null(),
                0,
            );
            if bytes_needed < size_of::<DevModePrefixW>() as i32 || bytes_needed > 262_144 {
                return None;
            }
            let mut base_dm = vec![0u64; (bytes_needed as usize).div_ceil(8)];
            if DocumentPropertiesW(
                null_mut(),
                handle.0,
                printer_w.as_mut_ptr(),
                base_dm.as_mut_ptr() as *mut c_void,
                null(),
                DM_OUT_BUFFER,
            ) < 0
            {
                return None;
            }

            // 1. Aşama: Sürücünün ilan ettiği yeteneklere saygılı tam yapılandırma
            let mut full_dm = base_dm.clone();
            let full_ptr = full_dm.as_mut_ptr() as *mut c_void;
            {
                let prefix = &mut *(full_ptr as *mut DevModePrefixW);
                let orig_fields = prefix.dm_fields;
                prefix.dm_orientation = if landscape { 2 } else { 1 };
                prefix.dm_copies = 1;
                prefix.dm_fields |= DM_ORIENTATION | DM_COPIES;

                if (orig_fields & DM_COLOR) != 0 {
                    prefix.dm_color = DMCOLOR_COLOR;
                    prefix.dm_fields |= DM_COLOR;
                }
                if effective_duplex != 1 || (orig_fields & DM_DUPLEX) != 0 {
                    prefix.dm_duplex = effective_duplex;
                    prefix.dm_fields |= DM_DUPLEX;
                }
                // Fotoğrafçının yüksek çözünürlüklü sürücü ayarını koru; yalnız Taslak/Düşük (<300 DPI) ise Yüksek yap.
                if (orig_fields & DM_PRINTQUALITY) != 0
                    && (prefix.dm_print_quality == DMRES_DRAFT
                        || prefix.dm_print_quality == DMRES_LOW
                        || (prefix.dm_print_quality > 0 && prefix.dm_print_quality < 300))
                {
                    prefix.dm_print_quality = DMRES_HIGH;
                    prefix.dm_fields |= DM_PRINTQUALITY;
                }
                if is_a4 {
                    prefix.dm_paper_size = DMPAPER_A4;
                    prefix.dm_fields = (prefix.dm_fields | DM_PAPERSIZE) & !(DM_PAPERLENGTH | DM_PAPERWIDTH);
                }
            }
            if DocumentPropertiesW(
                null_mut(),
                handle.0,
                printer_w.as_mut_ptr(),
                full_ptr,
                full_ptr,
                DM_IN_BUFFER | DM_OUT_BUFFER,
            ) >= 0
            {
                return Some(full_dm);
            }

            // 2. Aşama: Eski/seçici GDI sürücüler için yalnız yön + A4 boyutlu minimal devmode
            let min_ptr = base_dm.as_mut_ptr() as *mut c_void;
            {
                let prefix = &mut *(min_ptr as *mut DevModePrefixW);
                prefix.dm_orientation = if landscape { 2 } else { 1 };
                prefix.dm_fields |= DM_ORIENTATION;
                if is_a4 {
                    prefix.dm_paper_size = DMPAPER_A4;
                    prefix.dm_fields = (prefix.dm_fields | DM_PAPERSIZE) & !(DM_PAPERLENGTH | DM_PAPERWIDTH);
                }
            }
            let ok = DocumentPropertiesW(
                null_mut(),
                handle.0,
                printer_w.as_mut_ptr(),
                min_ptr,
                min_ptr,
                DM_IN_BUFFER | DM_OUT_BUFFER,
            );
            (ok >= 0).then_some(base_dm)
        }
    }

    #[allow(clippy::too_many_arguments)]
    unsafe fn blit_bgr24_page_or_banded(
        hdc: *mut c_void,
        rgb: &RgbImage,
        bgr_buf: &mut Vec<u8>,
        dest_x: i32,
        dest_y: i32,
        dest_w: i32,
        dest_h: i32,
        pels_x: i32,
        pels_y: i32,
    ) -> bool {
        let src_w = rgb.width();
        let src_h = rgb.height();
        pack_rgb_band_to_bottom_up_bgr24(rgb, 0, src_h, bgr_buf);
        let full_bmi = BitmapInfoHeader {
            bi_size: size_of::<BitmapInfoHeader>() as u32,
            bi_width: src_w as i32,
            bi_height: src_h as i32,
            bi_planes: 1,
            bi_bit_count: 24,
            bi_compression: 0,
            bi_size_image: bgr_buf.len() as u32,
            bi_x_pels_per_meter: pels_x,
            bi_y_pels_per_meter: pels_y,
            bi_clr_used: 0,
            bi_clr_important: 0,
        };
        let drawn = StretchDIBits(
            hdc,
            dest_x,
            dest_y,
            dest_w,
            dest_h,
            0,
            0,
            src_w as i32,
            src_h as i32,
            bgr_buf.as_ptr() as *const c_void,
            &full_bmi,
            0,
            SRCCOPY,
        );
        if drawn > 0 {
            return true;
        }

        // Eski düşük bellekli GDI/PCL5/CAPT sürücüleri büyük tek DIB'i reddederse 512 satırlık şeritlerle gönder.
        let mut sy0 = 0u32;
        while sy0 < src_h {
            let sy1 = (sy0 + FALLBACK_BAND_ROWS).min(src_h);
            let band_h = sy1 - sy0;
            pack_rgb_band_to_bottom_up_bgr24(rgb, sy0, sy1, bgr_buf);
            let (band_dest_y, band_dest_h) = compute_band_dest_span(sy0, sy1, src_h, dest_y, dest_h);
            let band_bmi = BitmapInfoHeader {
                bi_size: size_of::<BitmapInfoHeader>() as u32,
                bi_width: src_w as i32,
                bi_height: band_h as i32,
                bi_planes: 1,
                bi_bit_count: 24,
                bi_compression: 0,
                bi_size_image: bgr_buf.len() as u32,
                bi_x_pels_per_meter: pels_x,
                bi_y_pels_per_meter: pels_y,
                bi_clr_used: 0,
                bi_clr_important: 0,
            };
            let ok = StretchDIBits(
                hdc,
                dest_x,
                band_dest_y,
                dest_w,
                band_dest_h,
                0,
                0,
                src_w as i32,
                band_h as i32,
                bgr_buf.as_ptr() as *const c_void,
                &band_bmi,
                0,
                SRCCOPY,
            );
            if ok <= 0 {
                return false;
            }
            sy0 = sy1;
        }
        true
    }

    pub fn spool_validated_pages(
        printer_name: &str,
        job_title: &str,
        copies: u16,
        landscape: bool,
        duplex_code: i16,
        fit_page: bool,
        pages: &[ValidatedPrintPage],
    ) -> Result<(), &'static str> {
        let mut printer_w = to_wide_z(printer_name);
        let driver_w = to_wide_z("WINSPOOL");
        let title_w = to_wide_z(job_title);
        let first = &pages[0];
        let is_a4 = ((first.width_mm - 210.0).abs() < 1.5 && (first.height_mm - 297.0).abs() < 1.5)
            || ((first.width_mm - 297.0).abs() < 1.5 && (first.height_mm - 210.0).abs() < 1.5);
        let effective_duplex = if pages.len() <= 1 { 1 } else { duplex_code };

        let devmode_buf = build_driver_devmode(&mut printer_w, landscape, effective_duplex, is_a4);
        let devmode_ptr = devmode_buf
            .as_ref()
            .map_or(null(), |buf| buf.as_ptr() as *const c_void);

        unsafe {
            let mut raw_dc = CreateDCW(driver_w.as_ptr(), printer_w.as_ptr(), null(), devmode_ptr);
            if raw_dc.is_null() && !devmode_ptr.is_null() {
                raw_dc = CreateDCW(driver_w.as_ptr(), printer_w.as_ptr(), null(), null());
            }
            if raw_dc.is_null() {
                return Err(PRINT_SPOOL_ERROR);
            }
            let dc = DeviceContextGuard(raw_dc);

            let dpi_x = GetDeviceCaps(dc.0, LOGPIXELSX).max(72);
            let dpi_y = GetDeviceCaps(dc.0, LOGPIXELSY).max(72);
            let horz_res = GetDeviceCaps(dc.0, HORZRES).max(1);
            let vert_res = GetDeviceCaps(dc.0, VERTRES).max(1);
            let phys_w = GetDeviceCaps(dc.0, PHYSICALWIDTH).max(horz_res);
            let phys_h = GetDeviceCaps(dc.0, PHYSICALHEIGHT).max(vert_res);
            let offset_x = GetDeviceCaps(dc.0, PHYSICALOFFSETX).max(0);
            let offset_y = GetDeviceCaps(dc.0, PHYSICALOFFSETY).max(0);

            let doc_info = DocInfoW {
                cb_size: size_of::<DocInfoW>() as i32,
                lpsz_doc_name: title_w.as_ptr(),
                lpsz_output: null(),
                lpsz_datatype: null(),
                fw_type: 0,
            };
            if StartDocW(dc.0, &doc_info) <= 0 {
                return Err(PRINT_SPOOL_ERROR);
            }

            let mut bgr_buf = Vec::new();
            for copy_idx in 0..copies {
                for page in pages {
                    let mut rgb = match decode_rgb_bounded(&page.jpeg_bytes) {
                        Ok(img) => img,
                        Err(err) => {
                            let _ = AbortDoc(dc.0);
                            return Err(err);
                        }
                    };
                    let (eff_w_mm, eff_h_mm) = if should_auto_rotate_page(
                        page.width_mm,
                        page.height_mm,
                        phys_w,
                        phys_h,
                        dpi_x,
                        dpi_y,
                        fit_page,
                    ) {
                        rgb = image::imageops::rotate90(&rgb);
                        (page.height_mm, page.width_mm)
                    } else {
                        (page.width_mm, page.height_mm)
                    };

                    if StartPage(dc.0) <= 0 {
                        let _ = AbortDoc(dc.0);
                        return Err(PRINT_SPOOL_ERROR);
                    }
                    if SetStretchBltMode(dc.0, HALFTONE) != 0 {
                        let _ = SetBrushOrgEx(dc.0, 0, 0, null_mut());
                    } else {
                        let _ = SetStretchBltMode(dc.0, COLORONCOLOR);
                    }

                    let (dest_x, dest_y, dest_w, dest_h) = compute_page_dest_rect(
                        eff_w_mm, eff_h_mm, dpi_x, dpi_y, horz_res, vert_res, phys_w, phys_h,
                        offset_x, offset_y, fit_page,
                    );
                    let pels_x = pels_per_meter(rgb.width(), eff_w_mm);
                    let pels_y = pels_per_meter(rgb.height(), eff_h_mm);
                    let ok = blit_bgr24_page_or_banded(
                        dc.0, &rgb, &mut bgr_buf, dest_x, dest_y, dest_w, dest_h, pels_x, pels_y,
                    );
                    drop(rgb);

                    if !ok || EndPage(dc.0) <= 0 {
                        let _ = AbortDoc(dc.0);
                        return Err(PRINT_SPOOL_ERROR);
                    }
                }
                // Çift yüz baskıda tek sayıda sayfa varsa sonraki kopya yeni yaprağın ön yüzünden başlasın.
                if effective_duplex != 1 && pages.len() % 2 == 1 && copy_idx + 1 < copies {
                    if StartPage(dc.0) <= 0 || EndPage(dc.0) <= 0 {
                        let _ = AbortDoc(dc.0);
                        return Err(PRINT_SPOOL_ERROR);
                    }
                }
            }

            if EndDoc(dc.0) <= 0 {
                let _ = AbortDoc(dc.0);
                return Err(PRINT_SPOOL_ERROR);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgb;

    #[test]
    fn packs_24bit_bottom_up_bgr_with_dword_row_alignment_and_matching_bands() {
        // 3x2 görüntü: row_bytes = 9, DWORD stride = 12 (3 bayt 0 dolgusu)
        let mut img = RgbImage::new(3, 2);
        img.put_pixel(0, 0, Rgb([10, 20, 30]));
        img.put_pixel(1, 0, Rgb([40, 50, 60]));
        img.put_pixel(2, 0, Rgb([70, 80, 90]));
        img.put_pixel(0, 1, Rgb([110, 120, 130]));
        img.put_pixel(1, 1, Rgb([140, 150, 160]));
        img.put_pixel(2, 1, Rgb([170, 180, 190]));

        assert_eq!(bgr24_row_stride(1), 4);
        assert_eq!(bgr24_row_stride(2), 8);
        assert_eq!(bgr24_row_stride(3), 12);
        assert_eq!(bgr24_row_stride(4), 12);

        let mut full = Vec::new();
        pack_rgb_band_to_bottom_up_bgr24(&img, 0, 2, &mut full);
        assert_eq!(full.len(), 24);
        // Bottom-up DIB: alt satır (y=1) önce, üst satır (y=0) sonra; her piksel B,G,R sırasındadır.
        assert_eq!(&full[0..12], &[130, 120, 110, 160, 150, 140, 190, 180, 170, 0, 0, 0]);
        assert_eq!(&full[12..24], &[30, 20, 10, 60, 50, 40, 90, 80, 70, 0, 0, 0]);

        let mut top_band = Vec::new();
        let mut bot_band = Vec::new();
        pack_rgb_band_to_bottom_up_bgr24(&img, 0, 1, &mut top_band);
        pack_rgb_band_to_bottom_up_bgr24(&img, 1, 2, &mut bot_band);
        assert_eq!(top_band, &full[12..24]);
        assert_eq!(bot_band, &full[0..12]);
    }

    #[test]
    fn auto_rotates_mismatched_driver_orientation_without_rotating_small_cards_on_a4() {
        // Yatay A4 (297x210 mm), dikey kalmış A4 sürücüsünde (2480x3508 @300dpi) otomatik dönmelidir.
        assert!(should_auto_rotate_page(297.0, 210.0, 2480, 3508, 300, 300, false));
        // Yatay CR80 (85.6x54 mm), dikey CR80 kart yazıcıda (638x1011 @300dpi) otomatik dönmelidir.
        assert!(should_auto_rotate_page(85.6, 54.0, 638, 1011, 300, 300, false));
        // Yatay CR80 (85.6x54 mm), dikey A4 kağıtta %100 gerçek ölçüde zaten sığdığı için dönmemelidir.
        assert!(!should_auto_rotate_page(85.6, 54.0, 2480, 3508, 300, 300, false));
        // Aynı yönlü A4 dikey/yatay sayfalarda asla gereksiz dönmemelidir.
        assert!(!should_auto_rotate_page(210.0, 297.0, 2480, 3508, 300, 300, false));
        assert!(!should_auto_rotate_page(297.0, 210.0, 3508, 2480, 300, 300, false));
    }

    #[test]
    fn computes_exact_100_percent_mm_and_asymmetric_dpi_destinations_and_seamless_bands() {
        // 600x300 asimetrik eski lazer yazıcıda A4 (210x297 mm) tam gerçek milimetre boyutuna oturur.
        let (dx, dy, dw, dh) = compute_page_dest_rect(
            210.0, 297.0, 600, 300, 4800, 3400, 4961, 3508, 80, 54, false,
        );
        assert_eq!((dw, dh), (4961, 3508));
        assert_eq!((dx, dy), (-80, -54));

        // 300 DPI fiziksel piksel/metre yoğunluğu doğrulanır.
        assert!((pels_per_meter(2480, 210.0) - 11_810).abs() <= 2);

        // Ardışık şeritler piksel boşluğu veya çakışması olmadan tam birleşir.
        let (y0, h0) = compute_band_dest_span(0, 512, 3508, -50, 3508);
        let (y1, h1) = compute_band_dest_span(512, 1024, 3508, -50, 3508);
        let (ylast, hlast) = compute_band_dest_span(3072, 3508, 3508, -50, 3508);
        assert_eq!(y0, -50);
        assert_eq!(y0 + h0, y1);
        assert!(h1 > 0);
        assert_eq!(ylast + hlast, -50 + 3508);
    }

    #[test]
    fn validates_jpeg_magic_bounds_and_rejects_corrupt_or_out_of_range_pages() {
        let img = RgbImage::from_pixel(4, 4, Rgb([20, 40, 80]));
        let mut jpeg = Cursor::new(Vec::new());
        img.write_to(&mut jpeg, ImageFormat::Jpeg).unwrap();
        let valid_b64 = STANDARD.encode(jpeg.into_inner());

        let mut used = 0usize;
        let ok = validate_jpeg_page(
            &PrintPagePayload { jpeg_base64: valid_b64.clone(), width_mm: 210.0, height_mm: 297.0 },
            &mut used,
        );
        assert!(ok.is_ok());

        let mut used_bad = 0usize;
        assert!(validate_jpeg_page(
            &PrintPagePayload { jpeg_base64: STANDARD.encode(b"\x89PNG\r\n\x1a\n"), width_mm: 210.0, height_mm: 297.0 },
            &mut used_bad,
        ).is_err());
        assert!(validate_jpeg_page(
            &PrintPagePayload { jpeg_base64: valid_b64, width_mm: 10.0, height_mm: 297.0 },
            &mut used_bad,
        ).is_err());
    }
}
