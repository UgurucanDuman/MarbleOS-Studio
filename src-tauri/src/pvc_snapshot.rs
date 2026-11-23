use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PvcCardElement {
    id: String,
    kind: String,
    x_mm: f64,
    y_mm: f64,
    w_mm: f64,
    h_mm: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    rotation_deg: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    visible: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    locked: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    opacity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    radius_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    fill_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    fill_color2: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    gradient_angle: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    border_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    border_width_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shadow: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    shape_variant: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    photo_shape: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    image_data_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    image_fit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    photo_zoom: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    photo_pos_x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    photo_pos_y: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    field_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    prefix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    font_family: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    font_size_pt: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    font_weight: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    text_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    align: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    uppercase: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    max_lines: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    code_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    show_code_text: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sig_role: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PvcCardSide {
    background_color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    background_color2: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    background_gradient_angle: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    artwork_style: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    background_data_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    background_fit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    background_opacity: Option<f64>,
    elements: Vec<PvcCardElement>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PvcCustomDesign {
    id: String,
    name: String,
    orientation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    width_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    height_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    card_radius_mm: Option<f64>,
    front: PvcCardSide,
    back: PvcCardSide,
    updated_at: String,
}

fn is_bidi(ch: char) -> bool {
    matches!(
        ch,
        '\u{061C}' | '\u{200E}' | '\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}'
    )
}

fn safe_text(value: &str, min: usize, max: usize) -> bool {
    let trimmed = value.trim();
    (min..=max).contains(&value.encode_utf16().count())
        && !value.chars().any(|c| c.is_control() || is_bidi(c))
        && (trimmed.is_empty() || !matches!(trimmed.as_bytes()[0], b'=' | b'+' | b'-' | b'@'))
}

fn valid_color_token(value: &str) -> bool {
    value.is_empty()
        || value
            .strip_prefix('#')
            .is_some_and(|hex| hex.len() == 6 && hex.bytes().all(|b| b.is_ascii_hexdigit()))
        || matches!(
            value,
            "accent" | "accentSoft" | "accentDeep" | "surface" | "ink" | "inkMuted" | "onAccent" | "border"
        )
}

fn valid_data_url(value: &str, max_len: usize) -> bool {
    if value.is_empty() {
        return true;
    }
    if value.len() > max_len {
        return false;
    }
    let payload = value
        .strip_prefix("data:image/jpeg;base64,")
        .or_else(|| value.strip_prefix("data:image/png;base64,"))
        .or_else(|| value.strip_prefix("data:image/webp;base64,"));
    let Some(b64) = payload else { return false };
    let core = b64.strip_suffix("==").or_else(|| b64.strip_suffix('=')).unwrap_or(b64);
    !core.is_empty() && core.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
}

pub(crate) fn valid_pvc_field_key(value: &str) -> bool {
    matches!(
        value,
        "fullName" | "firstName" | "lastName" | "studentNumber" | "className" | "classAndNumber"
            | "role" | "department" | "nationalId" | "bloodType" | "birthDate" | "birthPlace"
            | "birthInfo" | "fatherName" | "motherName" | "registryNo" | "schoolName"
            | "schoolAddress" | "academicYear" | "cardTitle"
            | "studioName" | "studioOwner" | "studioPhone" | "studioAddress"
    )
}

pub(crate) fn valid_pvc_code_source(value: &str) -> bool {
    matches!(value, "studentNumber" | "nationalId" | "institutionAndNumber" | "studentSummary")
}

fn valid_element(el: &PvcCardElement) -> bool {
    !el.id.is_empty()
        && el.id.len() <= 48
        && el.id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        && matches!(
            el.kind.as_str(),
            "shape" | "photo" | "school-logo" | "studio-logo" | "signature" | "image"
                | "field" | "text" | "barcode" | "qrcode"
        )
        && (-25.0..=140.0).contains(&el.x_mm)
        && (-25.0..=140.0).contains(&el.y_mm)
        && (0.2..=140.0).contains(&el.w_mm)
        && (0.2..=140.0).contains(&el.h_mm)
        && el.rotation_deg.is_none_or(|v| (-180.0..=180.0).contains(&v))
        && el.opacity.is_none_or(|v| (0.05..=1.0).contains(&v))
        && el.radius_mm.is_none_or(|v| (0.0..=40.0).contains(&v))
        && el.fill_color.as_deref().is_none_or(valid_color_token)
        && el.fill_color2.as_deref().is_none_or(valid_color_token)
        && el.gradient_angle.is_none_or(|v| (0.0..=360.0).contains(&v))
        && el.border_color.as_deref().is_none_or(valid_color_token)
        && el.border_width_mm.is_none_or(|v| (0.0..=3.0).contains(&v))
        && el.shape_variant.as_deref().is_none_or(|v| matches!(v, "rect" | "circle" | "wave" | "diagonal" | "line"))
        && el.photo_shape.as_deref().is_none_or(|v| matches!(v, "rect" | "rounded" | "circle" | "arch" | "hexagon"))
        && el.image_data_url.as_deref().is_none_or(|v| valid_data_url(v, 2_800_000))
        && el.image_fit.as_deref().is_none_or(|v| matches!(v, "cover" | "contain"))
        && el.photo_zoom.is_none_or(|v| (0.7..=2.5).contains(&v))
        && el.photo_pos_x.is_none_or(|v| (0.0..=100.0).contains(&v))
        && el.photo_pos_y.is_none_or(|v| (0.0..=100.0).contains(&v))
        && el.field_key.as_deref().is_none_or(valid_pvc_field_key)
        && el.prefix.as_deref().is_none_or(|v| safe_text(v, 0, 32))
        && el.text.as_deref().is_none_or(|v| safe_text(v, 0, 200))
        && el.font_family.as_deref().is_none_or(|v| matches!(v, "sans" | "serif" | "display" | "mono"))
        && el.font_size_pt.is_none_or(|v| (4.0..=24.0).contains(&v))
        && el.font_weight.is_none_or(|v| matches!(v, 400 | 500 | 600 | 700 | 800))
        && el.text_color.as_deref().is_none_or(valid_color_token)
        && el.align.as_deref().is_none_or(|v| matches!(v, "left" | "center" | "right"))
        && el.max_lines.is_none_or(|v| (1..=4).contains(&v))
        && el.code_source.as_deref().is_none_or(valid_pvc_code_source)
        && el.sig_role.as_deref().is_none_or(|v| matches!(v, "principal" | "deputy"))
}

fn valid_side(side: &PvcCardSide) -> bool {
    let mut el_ids = HashSet::new();
    !side.background_color.is_empty()
        && valid_color_token(&side.background_color)
        && side.background_color2.as_deref().is_none_or(valid_color_token)
        && side.background_gradient_angle.is_none_or(|v| (0.0..=360.0).contains(&v))
        && side.artwork_style.as_deref().is_none_or(|v| {
            matches!(
                v,
                "none" | "corporate-wave" | "modern-diagonal" | "academic-crest"
                    | "lanyard-arch" | "swiss-minimal" | "guilloche-net"
            )
        })
        && side.background_data_url.as_deref().is_none_or(|v| valid_data_url(v, 4_500_000))
        && side.background_fit.as_deref().is_none_or(|v| matches!(v, "cover" | "contain"))
        && side.background_opacity.is_none_or(|v| (0.1..=1.0).contains(&v))
        && side.elements.len() <= 45
        && side.elements.iter().all(|el| el_ids.insert(el.id.as_str()) && valid_element(el))
}

pub(crate) fn valid_custom_designs(designs: &[PvcCustomDesign]) -> bool {
    if designs.len() > 15 {
        return false;
    }
    let mut ids = HashSet::new();
    designs.iter().all(|d| {
        !d.id.is_empty()
            && d.id.len() <= 64
            && d.id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
            && ids.insert(d.id.as_str())
            && safe_text(&d.name, 2, 60)
            && matches!(d.orientation.as_str(), "landscape" | "portrait")
            && d.width_mm.is_none_or(|v| (40.0..=130.0).contains(&v))
            && d.height_mm.is_none_or(|v| (40.0..=130.0).contains(&v))
            && d.card_radius_mm.is_none_or(|v| (0.0..=10.0).contains(&v))
            && valid_side(&d.front)
            && valid_side(&d.back)
            && safe_text(&d.updated_at, 1, 50)
    })
}

pub(crate) fn valid_pvc_single_line(value: &str, max: usize) -> bool {
    safe_text(value, 0, max)
}
