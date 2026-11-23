use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

pub const SNAPSHOT_LIMIT: usize = 32 * 1024 * 1024;
pub const COMMIT_INPUT_LIMIT: usize = 120 * 1024 * 1024;
pub const SCHOOL_ASSET_PREFIX: &str = "marbleos-school-asset:";
pub const PHOTO_COPY_PREFIX: &str = "marbleos-photo-copy:";
pub const INVALID_DATA: &str = "Yerel kayıt biçimi veya ilişkileri geçersiz.";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub(crate) schools: Vec<School>,
    active_school_id: Option<String>,
    classes: Vec<Class>,
    students: Vec<Student>,
    pub photos: Vec<Photo>,
    album_config: Album,
    sync_queue: Vec<QueueEntry>,
    last_synced_at: Option<String>,
}

fn default_logo_opacity() -> u8 { 35 }
fn default_school_zoom() -> f64 { 1.0 }

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct School {
    id: String,
    code: String,
    institution_code: String,
    name: String,
    address: String,
    notes: String,
    make_biometric: bool,
    make_vesikalik: bool,
    #[serde(default)]
    pub(crate) logo_data_url: String,
    #[serde(default = "default_logo_opacity")]
    transparent_logo_opacity: u8,
    #[serde(default)]
    pub(crate) principal_signature_data_url: String,
    #[serde(default)]
    pub(crate) deputy_signature_data_url: String,
    #[serde(default)]
    pub(crate) school_photo_data_url: String,
    #[serde(default = "default_school_zoom")]
    school_photo_zoom: f64,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Class {
    id: String,
    school_id: String,
    academic_year: String,
    name: String,
    teacher_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    deputy_principal_name: Option<String>,
    created_at: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StudentIdCard {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    national_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    department: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    blood_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    father_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mother_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    birth_place: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    birth_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    province: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    district: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    neighborhood: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    volume_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    family_serial_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    serial_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    document_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    registry_no: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Student {
    id: String,
    class_id: String,
    student_number: String,
    first_name: String,
    last_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    is_principal: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    show_in_album: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    group_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    id_card: Option<StudentIdCard>,
    matched_photo_id: Option<String>,
    print_ready: bool,
    updated_at: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Photo {
    pub id: String,
    pub file_name: String,
    pub data_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    class_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
    student_id: Option<String>,
    adjustments: Adjustments,
    approved_for_print: bool,
    created_at: String,
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Adjustments {
    zoom: f64,
    brightness: f64,
    contrast: f64,
    warmth: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    rotation: Option<i16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pan_x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pan_y: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tilt: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shadows: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    highlights: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    saturation: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sharpen: Option<f64>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Album {
    selected_class_id: String,
    layout_kind: String,
    header_title: String,
    accent_color: String,
    columns: u8,
    show_student_numbers: bool,
    show_teacher_badge: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    chart_template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    chart_palette_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    chart_ink_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    print_font_pt: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    course_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cover_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cover_subtitle: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    custom_cover_data_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    custom_cover_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_cols: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_rows: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_scope_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_deputy_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_include_cover: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_header: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_subtitle: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_staff_portraits: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_teacher_sig: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_deputy_sig: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_principal_sig: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_show_page_number: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_name_box_style: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_photo_frame: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    kutuk_frame_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_print_sides: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_cards_per_page: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_code_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_code_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_show_watermark: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_show_signature: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_show_studio_info: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_card_radius_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_card_width_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_card_height_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_photo_fit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_photo_zoom: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_photo_pos_x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_photo_pos_y: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_photo_shape: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_header_top_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_back_note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_hidden_fields: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pvc_custom_designs: Option<Vec<crate::pvc_snapshot::PvcCustomDesign>>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct QueueEntry {
    id: String,
    entity_type: String,
    entity_id: String,
    operation: String,
    summary: String,
    status: String,
    created_at: String,
}

pub fn is_id(value: &str) -> bool {
    Uuid::parse_str(value).is_ok_and(|id| id.hyphenated().to_string() == value)
}

fn is_bidi_spoof(ch: char) -> bool {
    matches!(
        ch,
        '\u{061C}' | '\u{200E}' | '\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}'
    )
}

fn text(value: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&value.encode_utf16().count())
        && !value.chars().any(|c| c.is_control() || is_bidi_spoof(c))
}

/// Adres ve not alanları: yalnız satır sonu ve sekme dışındaki kontrol/Bidi karakterleri reddedilir.
fn multiline(value: &str, max: usize) -> bool {
    value.encode_utf16().count() <= max
        && !value.chars().any(|c| {
            is_bidi_spoof(c) || (c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
        })
}

pub fn parse_school_asset_id(value: &str) -> Option<&str> {
    value.strip_prefix(SCHOOL_ASSET_PREFIX).filter(|id| is_id(id))
}

pub fn parse_photo_copy_id(value: &str) -> Option<&str> {
    value.strip_prefix(PHOTO_COPY_PREFIX).filter(|id| is_id(id))
}

fn valid_school_image(value: &str, max_len: usize) -> bool {
    value.is_empty()
        || parse_school_asset_id(value).is_some()
        || (value.len() <= max_len && (
            value.starts_with("data:image/jpeg;base64,")
            || value.starts_with("data:image/png;base64,")
            || value.starts_with("data:image/webp;base64,")
        ))
}

fn valid_school(school: &School) -> bool {
    is_id(&school.id)
        && school.code.len() == 5 && school.code.bytes().all(|b| b.is_ascii_digit())
        && school.institution_code.len() <= 12
        && school.institution_code.bytes().all(|b| b.is_ascii_digit())
        && text(&school.name, 2, 100) && school.name.trim() == school.name
        && multiline(&school.address, 300) && multiline(&school.notes, 2000)
        && valid_school_image(&school.logo_data_url, 4_500_000)
        && (10..=100).contains(&school.transparent_logo_opacity)
        && valid_school_image(&school.principal_signature_data_url, 4_500_000)
        && valid_school_image(&school.deputy_signature_data_url, 4_500_000)
        && valid_school_image(&school.school_photo_data_url, 11_500_000)
        && (1.0..=2.0).contains(&school.school_photo_zoom)
        && text(&school.created_at, 1, 50) && text(&school.updated_at, 1, 50)
}

fn valid_id_card(card: &StudentIdCard) -> bool {
    card.national_id.as_deref().is_none_or(|v| v.len() <= 11 && v.bytes().all(|b| b.is_ascii_digit()))
        && card.department.as_deref().is_none_or(|v| text(v, 0, 60))
        && card.blood_type.as_deref().is_none_or(|v| text(v, 0, 16))
        && card.father_name.as_deref().is_none_or(|v| text(v, 0, 50))
        && card.mother_name.as_deref().is_none_or(|v| text(v, 0, 50))
        && card.birth_place.as_deref().is_none_or(|v| text(v, 0, 50))
        && card.birth_date.as_deref().is_none_or(|v| text(v, 0, 24))
        && card.province.as_deref().is_none_or(|v| text(v, 0, 40))
        && card.district.as_deref().is_none_or(|v| text(v, 0, 40))
        && card.neighborhood.as_deref().is_none_or(|v| text(v, 0, 60))
        && card.volume_no.as_deref().is_none_or(|v| text(v, 0, 20))
        && card.family_serial_no.as_deref().is_none_or(|v| text(v, 0, 20))
        && card.serial_no.as_deref().is_none_or(|v| text(v, 0, 20))
        && card.document_no.as_deref().is_none_or(|v| text(v, 0, 30))
        && card.registry_no.as_deref().is_none_or(|v| text(v, 0, 30))
}

fn color(value: &str) -> bool {
    value.strip_prefix('#').is_some_and(|hex| {
        hex.len() == 6 && hex.bytes().all(|byte| byte.is_ascii_hexdigit())
    })
}

fn is_staff_class(name: &str) -> bool {
    let lower = name.trim().replace('I', "ı").replace('İ', "i").to_lowercase();
    ["öğretmen", "ogretmen", "idare", "kadro"].iter().any(|prefix| lower.starts_with(*prefix))
}

impl Snapshot {
    pub fn active_school_id(&self) -> Option<&str> {
        self.active_school_id.as_deref()
    }

    pub fn set_active_school_id(&mut self, school_id: Option<String>) {
        self.active_school_id = school_id;
    }

    pub fn school_ids(&self) -> Vec<String> {
        self.schools.iter().map(|school| school.id.clone()).collect()
    }

    pub fn has_school(&self, school_id: &str) -> bool {
        self.schools.iter().any(|school| school.id == school_id)
    }

    pub fn referenced_school_assets(&self) -> HashSet<String> {
        self.schools.iter().flat_map(|school| [
            &school.logo_data_url,
            &school.principal_signature_data_url,
            &school.deputy_signature_data_url,
            &school.school_photo_data_url,
        ]).filter_map(|value| parse_school_asset_id(value).map(str::to_owned)).collect()
    }

    pub fn has_inline_school_images(&self) -> bool {
        self.schools.iter().flat_map(|school| [
            &school.logo_data_url,
            &school.principal_signature_data_url,
            &school.deputy_signature_data_url,
            &school.school_photo_data_url,
        ]).any(|value| !value.is_empty() && parse_school_asset_id(value).is_none())
    }

    pub fn folder_for_photo(&self, photo: &Photo) -> Option<String> {
        let class_id = photo.class_id.as_deref().or_else(|| self.students.iter()
            .find(|student| Some(student.id.as_str()) == photo.student_id.as_deref())
            .map(|student| student.class_id.as_str()))?;
        let class = self.classes.iter().find(|class| class.id == class_id)?;
        let slug: String = class.name.chars().filter(|letter| letter.is_ascii_alphanumeric() || *letter == '-').collect();
        Some(format!("{}--{}", if slug.is_empty() { "sinif" } else { &slug }, class.id))
    }

    pub fn validate_update(&self, previous: Option<&Self>) -> Result<(), &'static str> {
        let transferred_students = match previous {
            Some(snapshot) => self.validate_student_transfers(snapshot)?,
            None => HashMap::new(),
        };
        let previous_photos: HashMap<_, _> = previous
            .into_iter()
            .flat_map(|snapshot| &snapshot.photos)
            .map(|photo| (photo.id.as_str(), photo))
            .collect();
        let current_classes: HashSet<_> = self.classes.iter().map(|class| class.id.as_str()).collect();
        for photo in &self.photos {
            match previous_photos.get(photo.id.as_str()) {
                Some(old) => {
                    if old.file_name != photo.file_name || old.created_at != photo.created_at
                        || old.content_hash != photo.content_hash
                    {
                        return Err(INVALID_DATA);
                    }
                    let transfer_target = old.student_id.as_deref()
                        .and_then(|id| transferred_students.get(id)).copied();
                    if let Some(target) = transfer_target {
                        if photo.student_id != old.student_id
                            || photo.class_id.as_deref() != Some(target)
                            || photo.approved_for_print
                        {
                            return Err(INVALID_DATA);
                        }
                    } else if let Some(scope) = old.class_id.as_deref() {
                        let expected = current_classes.contains(scope).then_some(scope);
                        if photo.class_id.as_deref() != expected {
                            return Err(INVALID_DATA);
                        }
                    }
                    if photo.approved_for_print
                        && (old.adjustments != photo.adjustments || old.student_id != photo.student_id)
                    {
                        return Err("Fotoğraf değişti. Baskı onayından önce yeni ayarları kaydedin.");
                    }
                }
                None if photo.approved_for_print => return Err(INVALID_DATA),
                None => {}
            }
        }
        Ok(())
    }

    fn validate_student_transfers<'a>(&'a self, previous: &Self) -> Result<HashMap<&'a str, &'a str>, &'static str> {
        let previous_students: HashMap<_, _> = previous.students.iter()
            .map(|student| (student.id.as_str(), student)).collect();
        let previous_classes: HashMap<_, _> = previous.classes.iter()
            .map(|class| (class.id.as_str(), class)).collect();
        let current_classes: HashMap<_, _> = self.classes.iter()
            .map(|class| (class.id.as_str(), class)).collect();
        let mut transferred = HashMap::new();

        for student in &self.students {
            let Some(old) = previous_students.get(student.id.as_str()) else { continue };
            if old.class_id == student.class_id { continue; }

            let source = previous_classes.get(old.class_id.as_str()).ok_or(INVALID_DATA)?;
            let target = current_classes.get(student.class_id.as_str()).ok_or(INVALID_DATA)?;
            if source.school_id != target.school_id || source.academic_year != target.academic_year
                || is_staff_class(&source.name) || is_staff_class(&target.name)
                || student.matched_photo_id != old.matched_photo_id || student.print_ready
            {
                return Err(INVALID_DATA);
            }
            transferred.insert(student.id.as_str(), student.class_id.as_str());
        }

        Ok(transferred)
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, &'static str> {
        Self::decode_with_limit(bytes, SNAPSHOT_LIMIT)
    }

    pub fn decode_commit(bytes: &[u8]) -> Result<Self, &'static str> {
        Self::decode_with_limit(bytes, COMMIT_INPUT_LIMIT)
    }

    fn decode_with_limit(bytes: &[u8], limit: usize) -> Result<Self, &'static str> {
        if bytes.len() > limit {
            return Err("Kayıt boyutu yerel sürümün sınırını aşıyor.");
        }
        let snapshot: Self = serde_json::from_slice(bytes).map_err(|_| INVALID_DATA)?;
        snapshot.validate()?;
        Ok(snapshot)
    }

    fn validate(&self) -> Result<(), &'static str> {
        if self.schools.len() > 500 || self.classes.len() > 2000 || self.students.len() > 20_000
            || self.photos.len() > 20_000 || self.sync_queue.len() > 10_000
            || self.last_synced_at.is_some()
        {
            return Err(INVALID_DATA);
        }
        let mut schools = HashSet::new();
        let mut school_codes = HashSet::new();
        let mut institution_codes = HashSet::new();
        // Okul adı tekrarı renderer iş kuralıdır (Türkçe harf katlaması); burada kimlik/kod bütünlüğü korunur.
        for school in &self.schools {
            if !valid_school(school) || !schools.insert(school.id.as_str())
                || !school_codes.insert(school.code.as_str())
                || (!school.institution_code.is_empty()
                    && !institution_codes.insert(school.institution_code.as_str()))
            {
                return Err(INVALID_DATA);
            }
        }
        if self.active_school_id.as_deref().is_some_and(|id| !schools.contains(id)) {
            return Err(INVALID_DATA);
        }
        let mut classes = HashSet::new();
        let mut class_names = HashSet::new();
        for class in &self.classes {
            if !is_id(&class.id) || !classes.insert(class.id.as_str())
                || !schools.contains(class.school_id.as_str())
                || !class_names.insert((&class.school_id, &class.academic_year, &class.name))
                || !text(&class.academic_year, 4, 20)
                || !text(&class.name, 1, 20) || !text(&class.teacher_name, 0, 60)
                || class.deputy_principal_name.as_deref().is_some_and(|value| !text(value, 0, 60))
                || !text(&class.created_at, 1, 50)
            {
                return Err(INVALID_DATA);
            }
        }
        let mut photos = HashMap::new();
        for photo in &self.photos {
            let a = &photo.adjustments;
            if !is_id(&photo.id) || photos.insert(photo.id.as_str(), photo).is_some()
                || photo.class_id.as_deref().is_some_and(|id| !classes.contains(id))
                || photo.content_hash.as_deref().is_some_and(|hash| hash.len() != 64
                    || !hash.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)))
                || !text(&photo.file_name, 1, 255) || !text(&photo.created_at, 1, 50)
                || photo.data_url.len() > (crate::media::MAX_ORIGINAL.div_ceil(3) * 4 + 24)
                || !(1.0..=2.5).contains(&a.zoom)
                || !(70.0..=135.0).contains(&a.brightness) || !(70.0..=135.0).contains(&a.contrast)
                || !(-30.0..=30.0).contains(&a.warmth)
                || a.rotation.is_some_and(|rot| !matches!(rot, 0 | 90 | 180 | 270))
                || a.pan_x.is_some_and(|v| !(-45.0..=45.0).contains(&v))
                || a.pan_y.is_some_and(|v| !(-45.0..=45.0).contains(&v))
                || a.tilt.is_some_and(|v| !(-10.0..=10.0).contains(&v))
                || a.shadows.is_some_and(|v| !(-30.0..=50.0).contains(&v))
                || a.highlights.is_some_and(|v| !(-50.0..=30.0).contains(&v))
                || a.saturation.is_some_and(|v| !(0.0..=140.0).contains(&v))
                || a.sharpen.is_some_and(|v| !(0.0..=40.0).contains(&v))
            {
                return Err(INVALID_DATA);
            }
        }
        let mut students = HashMap::new();
        let mut numbers = HashSet::new();
        for student in &self.students {
            if !is_id(&student.id) || students.insert(student.id.as_str(), student).is_some()
                || !classes.contains(student.class_id.as_str())
                || !numbers.insert((&student.class_id, &student.student_number))
                || !text(&student.student_number, 1, 15)
                || !student.student_number.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                || !text(&student.first_name, 2, 60) || !text(&student.last_name, 1, 60)
                || student.role.as_deref().is_some_and(|value| !text(value, 0, 60))
                || student.group_code.as_deref().is_some_and(|value| !text(value, 0, 24))
                || student.id_card.as_ref().is_some_and(|card| !valid_id_card(card))
                || !text(&student.updated_at, 1, 50)
            {
                return Err(INVALID_DATA);
            }
            match student.matched_photo_id.as_deref() {
                Some(id) => {
                    let photo = photos.get(id).ok_or(INVALID_DATA)?;
                    if photo.student_id.as_deref() != Some(student.id.as_str())
                        || photo.class_id.as_deref().is_some_and(|id| id != student.class_id)
                        || photo.approved_for_print != student.print_ready
                    {
                        return Err(INVALID_DATA);
                    }
                }
                None if student.print_ready => return Err(INVALID_DATA),
                None => {}
            }
        }
        for photo in &self.photos {
            match photo.student_id.as_deref() {
                Some(id) if students.get(id).and_then(|s| s.matched_photo_id.as_deref())
                    == Some(photo.id.as_str()) => {}
                None if !photo.approved_for_print => {}
                _ => return Err(INVALID_DATA),
            }
        }
        let album = &self.album_config;
        if (!album.selected_class_id.is_empty() && !classes.contains(album.selected_class_id.as_str()))
            || !matches!(album.layout_kind.as_str(), "class-chart" | "yearbook-spread" | "id-card")
            || !text(&album.header_title, 0, 120) || !color(&album.accent_color)
            || !(2..=10).contains(&album.columns)
            || album.chart_template_id.as_deref().is_some_and(|v| {
                v.is_empty() || v.len() > 40 || !v.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
            })
            || album.chart_palette_id.as_deref().is_some_and(|v| {
                !matches!(
                    v,
                    "classic-navy"
                        | "emerald-ink"
                        | "crimson-slate"
                        | "anatolian-teal"
                        | "royal-azure"
                        | "imperial-plum"
                        | "nordic-slate"
                        | "pure-mono"
                )
            })
            || album.chart_ink_id.as_deref().is_some_and(|v| {
                !matches!(
                    v,
                    "obsidian-black"
                        | "graphite-charcoal"
                        | "meb-navy"
                        | "oxford-blue"
                        | "cobalt-sky"
                        | "seljuk-teal"
                        | "emerald-forest"
                        | "pine-olive"
                        | "midnight-indigo"
                        | "royal-plum"
                        | "berry-magenta"
                        | "anatolian-burgundy"
                )
            })
            || album.print_font_pt.is_some_and(|v| !matches!(v, 8..=10))
            || album.course_name.as_deref().is_some_and(|v| !text(v, 0, 60))
            || album.cover_title.as_deref().is_some_and(|v| !text(v, 0, 80))
            || album.cover_subtitle.as_deref().is_some_and(|v| !text(v, 0, 80))
            || album.custom_cover_data_url.as_deref().is_some_and(|v| !valid_school_image(v, 4_500_000))
            || album.custom_cover_mode.as_deref().is_some_and(|v| !matches!(v, "full-bleed" | "emblem"))
            || album.kutuk_template_id.as_deref().is_some_and(|v| {
                !matches!(
                    v,
                    "kutuk-portrait-25"
                        | "kutuk-portrait-30"
                        | "kutuk-portrait-35"
                        | "kutuk-portrait-49"
                        | "kutuk-landscape-24"
                        | "kutuk-landscape-30"
                        | "kutuk-landscape-35"
                        | "kutuk-landscape-40"
                        | "kutuk-landscape-50"
                        | "kutuk-cover-portrait"
                        | "kutuk-cover-landscape"
                )
            })
            || album.kutuk_cols.is_some_and(|v| !(3..=10).contains(&v))
            || album.kutuk_rows.is_some_and(|v| !(3..=7).contains(&v))
            || album.kutuk_scope_mode.as_deref().is_some_and(|v| !matches!(v, "all-classes" | "deputy" | "single-class"))
            || album.kutuk_deputy_name.as_deref().is_some_and(|v| !text(v, 0, 60))
            || album.kutuk_name_box_style.as_deref().is_some_and(|v| {
                !matches!(v, "apple-soft" | "filled-band" | "minimal-clean" | "classic-grid")
            })
            || album.kutuk_photo_frame.as_deref().is_some_and(|v| {
                !matches!(v, "rounded" | "sharp" | "double-frame" | "frameless")
            })
            || album.kutuk_frame_color.as_deref().is_some_and(|v| !v.is_empty() && !color(v))
            || album.pvc_template_id.as_deref().is_some_and(|v| {
                v.is_empty() || v.len() > 64 || !v.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
            })
            || album.pvc_print_sides.as_deref().is_some_and(|v| {
                !matches!(v, "front-only" | "back-only" | "front-and-back")
            })
            || album.pvc_cards_per_page.is_some_and(|v| !(1..=10).contains(&v))
            || album.pvc_code_type.as_deref().is_some_and(|v| {
                !matches!(v, "barcode" | "qrcode" | "none")
            })
            || album.pvc_code_source.as_deref().is_some_and(|v| {
                !crate::pvc_snapshot::valid_pvc_code_source(v)
            })
            || album.pvc_card_radius_mm.is_some_and(|v| !(0.0..=10.0).contains(&v))
            || album.pvc_card_width_mm.is_some_and(|v| !(40.0..=130.0).contains(&v))
            || album.pvc_card_height_mm.is_some_and(|v| !(40.0..=130.0).contains(&v))
            || album.pvc_photo_fit.as_deref().is_some_and(|v| !matches!(v, "cover" | "contain"))
            || album.pvc_photo_zoom.is_some_and(|v| !(0.7..=2.5).contains(&v))
            || album.pvc_photo_pos_x.is_some_and(|v| !(0.0..=100.0).contains(&v))
            || album.pvc_photo_pos_y.is_some_and(|v| !(0.0..=100.0).contains(&v))
            || album.pvc_photo_shape.as_deref().is_some_and(|v| {
                !matches!(v, "rect" | "rounded" | "circle" | "arch" | "hexagon")
            })
            || album.pvc_header_top_text.as_deref().is_some_and(|v| !crate::pvc_snapshot::valid_pvc_single_line(v, 80))
            || album.pvc_back_note.as_deref().is_some_and(|v| !crate::pvc_snapshot::valid_pvc_single_line(v, 180))
            || album.pvc_hidden_fields.as_deref().is_some_and(|list| {
                list.len() > 24 || list.iter().any(|f| !crate::pvc_snapshot::valid_pvc_field_key(f))
            })
            || album.pvc_custom_designs.as_deref().is_some_and(|designs| {
                !crate::pvc_snapshot::valid_custom_designs(designs)
            })
        {
            return Err(INVALID_DATA);
        }
        let mut queue_ids = HashSet::new();
        if self.sync_queue.iter().any(|entry| {
            !is_id(&entry.id) || !queue_ids.insert(&entry.id) || !is_id(&entry.entity_id)
                || !matches!(entry.entity_type.as_str(), "school" | "class" | "student" | "photo" | "album")
                || !matches!(entry.operation.as_str(), "INSERT" | "UPDATE" | "DELETE")
                || entry.status != "PENDING" || !text(&entry.summary, 1, 512)
                || !text(&entry.created_at, 1, 50)
        }) {
            return Err(INVALID_DATA);
        }
        Ok(())
    }
}
