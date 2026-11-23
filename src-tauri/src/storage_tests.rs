use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::io::Cursor;
use tempfile::TempDir;

const PHOTO: &str = "16274a4a-16c7-43ec-a868-e7b503244c9e";
const SECOND_PHOTO: &str = "84763810-499a-4ccc-a6f5-8f19593aeea3";
const SCHOOL: &str = "Deneme Okulu – sadece test";
const SCHOOL_ID: &str = "0b3c4f8e-2d55-4b8a-9b0e-6a1f2f3d4c5e";
const CLASS: &str = "51967cae-a326-45f1-87a7-eb413e068a1d";

fn test_store() -> (TempDir, StudioStorage) {
    let folder = tempfile::tempdir().unwrap();
    let store = StudioStorage::new(folder.path().join("studio"));
    (folder, store)
}

fn school(id: &str, code: &str, institution_code: &str) -> Value {
    json!({
        "id":id, "code":code, "institutionCode":institution_code, "name":SCHOOL,
        "address":"Satır 1\nSatır 2", "notes":"", "makeBiometric":false, "makeVesikalik":true,
        "createdAt":"2026-11-05T00:00:00Z", "updatedAt":"2026-11-05T00:00:00Z"
    })
}

fn base_snapshot() -> Value {
    json!({
        "schools": [school(SCHOOL_ID, "00001", "000123")], "activeSchoolId": SCHOOL_ID,
        "classes": [{"id":CLASS, "schoolId":SCHOOL_ID, "academicYear":"2026",
            "name":"1-A", "teacherName":"", "createdAt":"2026-11-05T00:00:00Z"}],
        "students": [], "photos": [], "syncQueue": [], "lastSyncedAt": null,
        "albumConfig": {"selectedClassId":CLASS, "layoutKind":"class-chart",
            "headerTitle":"", "accentColor":"#a1a1aa", "columns":4,
            "showStudentNumbers":true, "showTeacherBadge":true}
    })
}

fn png_data() -> (String, Vec<u8>) {
    let img = image::DynamicImage::new_rgb8(2, 2);
    let mut bytes = Cursor::new(Vec::new());
    img.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
    let bytes = bytes.into_inner();
    (format!("data:image/png;base64,{}", STANDARD.encode(&bytes)), bytes)
}

fn photo(id: &str, data_url: &str) -> Value {
    json!({
        "id":id, "fileName":"sample.png", "dataUrl":data_url, "studentId":null,
        "adjustments":{"zoom":1.0,"brightness":100.0,"contrast":100.0,"warmth":0.0},
        "approvedForPrint":false, "createdAt":"2026-11-05T00:00:00Z"
    })
}

#[test]
fn restart_reads_encrypted_sqlite_and_original_is_stored_separately() {
    let (_folder, store) = test_store();
    let (url, image) = png_data();
    let mut snapshot = base_snapshot();
    snapshot["photos"] = json!([photo(PHOTO, &url)]);
    let saved = store.commit(0, &snapshot.to_string()).unwrap();
    assert_eq!(saved.revision, 1);
    let reopened = StudioStorage::new(store.root.clone());
    assert_eq!(reopened.load().unwrap().snapshot_json, saved.snapshot_json);
    let database = fs::read(store.root.join("data/marbleos_studio.db")).unwrap();
    assert!(database.starts_with(b"SQLite format 3\0"));
    assert!(!database.windows(SCHOOL.len()).any(|part| part == SCHOOL.as_bytes()));
    let original = fs::read(store.root.join("media/originals").join(format!("{PHOTO}.dpapi"))).unwrap();
    assert!(!original.starts_with(b"\x89PNG"));
    assert!(crypto::is_aead_blob(&original));
    let scope = format!("marbleos-studio:originals:v1:{PHOTO}");
    assert!(crypto::open(&original, scope.as_bytes()).is_err());
    let conn = store.connect().unwrap();
    let wrapped_dek: Vec<u8> = conn.query_row("SELECT dpapi_wrapped_dek FROM vault_key WHERE id=1", [], |r| r.get(0)).unwrap();
    let dek = crypto::DataKey::from_slice(&crypto::open(&wrapped_dek, vault::DPAPI_DEK_SCOPE).unwrap()).unwrap();
    assert_eq!(crypto::open_with_key(&dek, &original, scope.as_bytes()).unwrap(), image);
    assert!(crypto::open_with_key(&dek, &original, b"different-file").is_err());
    assert!(reopened.preview(PHOTO).unwrap().starts_with("data:image/png;base64,"));
    assert!(reopened.preview("../originals").is_err());
}

#[test]
fn imports_a_real_png_larger_than_eight_megabytes() {
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    let mut seed = 0x12345678_u32;
    let image = image::RgbImage::from_fn(1900, 1500, |_, _| {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        let bytes = seed.to_le_bytes();
        image::Rgb([bytes[0], bytes[1], bytes[2]])
    });
    let mut png = Cursor::new(Vec::new());
    image.write_to(&mut png, image::ImageFormat::Png).unwrap();
    assert!((8_000_000..10_000_000).contains(&png.get_ref().len()));
    let data_url = format!("data:image/png;base64,{}", STANDARD.encode(png.into_inner()));
    snapshot["photos"] = json!([photo(PHOTO, &data_url)]);
    snapshot["photos"][0]["classId"] = json!(CLASS);
    store.commit(0, &snapshot.to_string()).unwrap();
    let reopened = StudioStorage::new(store.root.clone());
    let persisted: Value = serde_json::from_str(&reopened.load().unwrap().snapshot_json.unwrap()).unwrap();
    assert_eq!(persisted["photos"][0]["classId"], CLASS);
    assert_eq!(persisted["photos"][0]["dataUrl"], "");
    assert!(reopened.preview(PHOTO).unwrap().starts_with("data:image/png;base64,"));
}

#[test]
fn invalid_second_file_rolls_back_first_file_and_sqlite() {
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    snapshot["photos"] = json!([
        photo(PHOTO, &png_data().0), photo(SECOND_PHOTO, "data:image/png;base64,YQ==")
    ]);
    assert!(store.commit(0, &snapshot.to_string()).is_err());
    assert_eq!(store.load().unwrap().revision, 0);
    for kind in ["originals", "previews"] {
        assert_eq!(fs::read_dir(store.root.join("media").join(kind)).unwrap().count(), 0);
    }
    assert!(store.preview(PHOTO).is_err());
}

#[test]
fn failed_sql_commit_removes_new_media_and_allows_retry() {
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    let before = store.commit(0, &snapshot.to_string()).unwrap();
    let conn = store.connect().unwrap();
    conn.execute_batch(
        "CREATE TABLE commit_parent (id INTEGER PRIMARY KEY) STRICT;
         CREATE TABLE commit_child (
             parent_id INTEGER REFERENCES commit_parent(id) DEFERRABLE INITIALLY DEFERRED
         ) STRICT;
         CREATE TRIGGER fail_workspace_commit AFTER UPDATE ON workspace BEGIN
             INSERT INTO commit_child VALUES (1);
         END;",
    ).unwrap();
    snapshot["photos"] = json!([photo(PHOTO, &png_data().0)]);

    assert_eq!(store.commit(before.revision, &snapshot.to_string()).err(), Some(IO_ERROR));
    assert_eq!(store.load().unwrap().snapshot_json, before.snapshot_json);
    for kind in ["originals", "previews"] {
        assert_eq!(fs::read_dir(store.root.join("media").join(kind)).unwrap().count(), 0);
    }

    conn.execute_batch("DROP TRIGGER fail_workspace_commit").unwrap();
    assert_eq!(store.commit(before.revision, &snapshot.to_string()).unwrap().revision, 2);
    assert!(store.preview(PHOTO).is_ok());
}

#[test]
fn outdated_revision_does_not_overwrite_and_corrupt_record_is_preserved() {
    let (_folder, store) = test_store();
    let original = base_snapshot().to_string();
    store.commit(0, &original).unwrap();
    let mut newer = base_snapshot();
    newer["albumConfig"]["headerTitle"] = json!("Yeni sürüm");
    let winner = store.commit(1, &newer.to_string()).unwrap().snapshot_json;
    assert_eq!(store.commit(1, &original).err(), Some(CONFLICT));
    assert_eq!(store.load().unwrap().snapshot_json, winner);
    let conn = store.connect().unwrap();
    conn.execute("UPDATE workspace SET encrypted_snapshot = X'010203'", []).unwrap();
    assert!(store.load().is_err());
    assert!(store.commit(2, &original).is_err());
    let still_corrupt: Vec<u8> = conn.query_row(
        "SELECT encrypted_snapshot FROM workspace", [], |row| row.get(0)
    ).unwrap();
    assert_eq!(still_corrupt, [1, 2, 3]);
}

#[test]
fn two_writers_cannot_both_commit_the_same_revision() {
    use std::sync::{Arc, Barrier};

    let (_folder, store) = test_store();
    store.load().unwrap();
    let barrier = Arc::new(Barrier::new(2));
    let attempts = ["Birinci", "İkinci"].map(|title| {
        let store = store.clone();
        let barrier = barrier.clone();
        std::thread::spawn(move || {
            let mut snapshot = base_snapshot();
            snapshot["albumConfig"]["headerTitle"] = json!(title);
            barrier.wait();
            store.commit(0, &snapshot.to_string())
        })
    });
    let [a, b] = attempts.map(|attempt| attempt.join().unwrap());
    let winner = match (a, b) {
        (Ok(winner), Err(CONFLICT)) | (Err(CONFLICT), Ok(winner)) => winner,
        _ => panic!("expected exactly one committed revision"),
    };
    assert_eq!(store.load().unwrap().snapshot_json, winner.snapshot_json);
}

#[test]
fn rejects_duplicate_school_numbers_and_orphan_links_before_writing() {
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    let mut student = json!({
        "id":PHOTO,"classId":CLASS,"studentNumber":"001","firstName":"Ada","lastName":"Test",
        "matchedPhotoId":null,"printReady":false,"updatedAt":"2026-11-05T00:00:00Z"
    });
    snapshot["students"] = json!([student.clone()]);
    snapshot["students"][0]["matchedPhotoId"] = json!(SECOND_PHOTO);
    assert!(store.commit(0, &snapshot.to_string()).is_err());
    snapshot["students"][0] = student.clone();
    student["id"] = json!(SECOND_PHOTO);
    snapshot["students"].as_array_mut().unwrap().push(student);
    assert!(store.commit(0, &snapshot.to_string()).is_err());
    assert_eq!(store.load().unwrap().revision, 0);
}

#[test]
fn transfers_a_student_and_photo_within_the_same_school_year() {
    let (_folder, store) = test_store();
    let target = uuid::Uuid::new_v4().to_string();
    let other_school = uuid::Uuid::new_v4().to_string();
    let student_id = uuid::Uuid::new_v4().to_string();
    let (url, _) = png_data();
    let mut snapshot = base_snapshot();
    let mut other_class = snapshot["classes"][0].clone();
    other_class["id"] = json!(&target);
    other_class["name"] = json!("1-B");
    snapshot["classes"].as_array_mut().unwrap().push(other_class);
    snapshot["schools"].as_array_mut().unwrap().push(school(&other_school, "00002", ""));
    snapshot["students"] = json!([{
        "id": &student_id, "classId": CLASS, "studentNumber": "001", "firstName": "Ada",
        "lastName": "Test", "matchedPhotoId": PHOTO, "printReady": false,
        "updatedAt": "2026-11-05T00:00:00Z"
    }]);
    snapshot["photos"] = json!([photo(PHOTO, &url)]);
    snapshot["photos"][0]["classId"] = json!(CLASS);
    snapshot["photos"][0]["studentId"] = json!(&student_id);

    let initial = store.commit(0, &snapshot.to_string()).unwrap();
    let mut approved: Value = serde_json::from_str(initial.snapshot_json.as_deref().unwrap()).unwrap();
    approved["students"][0]["printReady"] = json!(true);
    approved["photos"][0]["approvedForPrint"] = json!(true);
    let saved = store.commit(initial.revision, &approved.to_string()).unwrap();
    let before_preview = store.preview(PHOTO).unwrap();

    let mut moved = approved.clone();
    moved["students"][0]["classId"] = json!(&target);
    moved["photos"][0]["classId"] = json!(&target);
    assert!(store.commit(saved.revision, &moved.to_string()).is_err());
    moved["students"][0]["printReady"] = json!(false);
    moved["photos"][0]["approvedForPrint"] = json!(false);

    for (field, value) in [
        ("academicYear", json!("2027")),
        ("name", json!("ÖĞRETMENLER")),
        ("schoolId", json!(&other_school)),
    ] {
        let mut invalid = moved.clone();
        invalid["classes"][1][field] = value;
        assert!(store.commit(saved.revision, &invalid.to_string()).is_err());
    }
    let mut unscoped_photo = moved.clone();
    unscoped_photo["photos"][0].as_object_mut().unwrap().remove("classId");
    assert!(store.commit(saved.revision, &unscoped_photo.to_string()).is_err());
    assert_eq!(store.load().unwrap().snapshot_json, saved.snapshot_json);

    let next = store.commit(saved.revision, &moved.to_string()).unwrap();
    let result: Value = serde_json::from_str(next.snapshot_json.as_deref().unwrap()).unwrap();
    assert_eq!(result["students"][0]["id"], student_id.as_str());
    assert_eq!(result["students"][0]["classId"], target.as_str());
    assert_eq!(result["students"][0]["matchedPhotoId"], PHOTO);
    assert_eq!(result["photos"][0]["classId"], target.as_str());
    assert_eq!(store.original(PHOTO, None).unwrap(), url);
    assert_eq!(store.preview(PHOTO).unwrap(), before_preview);
}

#[test]
fn rejects_orphan_classes_duplicate_school_codes_and_control_characters() {
    let (_folder, store) = test_store();
    let mut orphan = base_snapshot();
    orphan["classes"][0]["schoolId"] = json!(SECOND_PHOTO);
    assert!(store.commit(0, &orphan.to_string()).is_err());
    let mut missing_active = base_snapshot();
    missing_active["activeSchoolId"] = json!(SECOND_PHOTO);
    assert!(store.commit(0, &missing_active.to_string()).is_err());
    for (code, institution) in [("00001", ""), ("00002", "000123")] {
        let mut duplicate = base_snapshot();
        let mut other = school(SECOND_PHOTO, code, institution);
        other["name"] = json!("Başka Okul");
        duplicate["schools"].as_array_mut().unwrap().push(other);
        assert!(store.commit(0, &duplicate.to_string()).is_err());
    }
    let mut control = base_snapshot();
    control["schools"][0]["name"] = json!("Okul\u{0007}");
    assert!(store.commit(0, &control.to_string()).is_err());
    let mut bidi = base_snapshot();
    bidi["schools"][0]["name"] = json!("Okul\u{202E}gnp.exe");
    assert!(store.commit(0, &bidi.to_string()).is_err());
    let mut letters = base_snapshot();
    letters["schools"][0]["institutionCode"] = json!("12A");
    assert!(store.commit(0, &letters.to_string()).is_err());
    assert_eq!(store.load().unwrap().revision, 0);
    let saved = store.commit(0, &base_snapshot().to_string()).unwrap();
    assert!(saved.snapshot_json.unwrap().contains("\"institutionCode\":\"000123\""));
}

#[test]
fn reads_dpapi_original_with_hash_check_and_restores_into_fresh_store() {
    let (_src_dir, store) = test_store();
    let img = image::DynamicImage::ImageRgb8(image::RgbImage::from_fn(640, 480, |x, y| {
        image::Rgb([(x & 0xff) as u8, (y & 0xff) as u8, 120])
    }));
    let mut jpeg = Cursor::new(Vec::new());
    img.write_to(&mut jpeg, image::ImageFormat::Jpeg).unwrap();
    let jpeg_url = format!("data:image/jpeg;base64,{}", STANDARD.encode(jpeg.into_inner()));

    let mut snapshot = base_snapshot();
    let mut item = photo(PHOTO, &jpeg_url);
    item["classId"] = json!(CLASS);
    snapshot["photos"] = json!([item]);
    let committed = store.commit(0, &snapshot.to_string()).unwrap();
    let persisted: Value = serde_json::from_str(&committed.snapshot_json.unwrap()).unwrap();
    let hash = persisted["photos"][0]["contentHash"].as_str().unwrap();

    // Tam çözünürlüklü JPEG orijinal geri okunur (512px PNG önizleme değil).
    assert_eq!(store.original(PHOTO, Some(hash)).unwrap(), jpeg_url);
    assert!(store.preview(PHOTO).unwrap().starts_with("data:image/png;base64,"));

    // Yanlış hash, geçersiz hash biçimi ve yol kaçışı reddedilir.
    let wrong_hash = "0".repeat(64);
    assert!(store.original(PHOTO, Some(&wrong_hash)).is_err());
    assert!(store.original(PHOTO, Some("kisa")).is_err());
    assert!(store.original("../originals", None).is_err());

    // Ayrı bir çalışma alanına yeni UUID ile geri yüklenebilir.
    let (_dst_dir, restored_store) = test_store();
    let mut restored = base_snapshot();
    let mut restored_photo = photo(SECOND_PHOTO, &store.original(PHOTO, Some(hash)).unwrap());
    restored_photo["classId"] = json!(CLASS);
    restored_photo["contentHash"] = json!(hash);
    restored["photos"] = json!([restored_photo]);
    restored_store.commit(0, &restored.to_string()).unwrap();
    let reopened = StudioStorage::new(restored_store.root.clone());
    assert_eq!(reopened.original(SECOND_PHOTO, Some(hash)).unwrap(), jpeg_url);
    assert!(reopened.preview(SECOND_PHOTO).unwrap().starts_with("data:image/png;base64,"));
}

#[test]
fn restores_multi_class_school_above_150_photos_and_rolls_back_corrupt_tail() {
    let (url, _) = png_data();
    let make_id = |index: usize| format!("10000000-0000-4000-8000-{index:012x}");

    // 1) Son fotoğraf bozuksa önceki 159 şifreli dosya ve SQLite tamamen geri alınır.
    let (_bad_dir, bad_store) = test_store();
    let mut bad_snapshot = base_snapshot();
    let mut bad_photos: Vec<Value> = (0..159).map(|i| photo(&make_id(i), &url)).collect();
    bad_photos.push(photo(&make_id(159), "data:image/png;base64,YQ=="));
    bad_snapshot["photos"] = json!(bad_photos);
    assert!(bad_store.commit(0, &bad_snapshot.to_string()).is_err());
    assert_eq!(bad_store.load().unwrap().revision, 0);
    for kind in ["originals", "previews"] {
        assert_eq!(fs::read_dir(bad_store.root.join("media").join(kind)).unwrap().count(), 0);
    }

    // 2) 160 geçerli fotoğraf içeren okul yedeği tek atomik işlemde kaydedilir ve okunur.
    let (_ok_dir, ok_store) = test_store();
    let mut ok_snapshot = base_snapshot();
    let ok_photos: Vec<Value> = (0..160).map(|i| photo(&make_id(i), &url)).collect();
    ok_snapshot["photos"] = json!(ok_photos);
    assert_eq!(ok_store.commit(0, &ok_snapshot.to_string()).unwrap().revision, 1);
    assert_eq!(ok_store.original(&make_id(0), None).unwrap(), url);
    assert_eq!(ok_store.original(&make_id(159), None).unwrap(), url);
}

#[test]
fn school_visuals_are_decoded_stored_separately_and_cleaned_up_on_replace_or_delete() {
    let (_folder, store) = test_store();
    let (valid_png, _) = png_data();

    // 1) Başlığı data:image/png gibi görünen ama bozuk bayt içeren logo reddedilir, 0 dosya kalır.
    let mut bad = base_snapshot();
    bad["schools"][0]["logoDataUrl"] = json!("data:image/png;base64,YQ==");
    assert!(store.commit(0, &bad.to_string()).is_err());
    assert_eq!(store.load().unwrap().revision, 0);

    // 2) Sahte referans ("marbleos-school-asset:<uuid>") reddedilir.
    let mut forged = base_snapshot();
    forged["schools"][0]["logoDataUrl"] = json!(format!("marbleos-school-asset:{PHOTO}"));
    assert!(store.commit(0, &forged.to_string()).is_err());

    // 3) 3 MiB ham boyutu aşan geçerli PNG, logo yuvasında reddedilir; kapak resmi yuvasında (<= 8 MiB) kabul edilir.
    let mut seed = 0x9e3779b9_u32;
    let big_img = image::RgbImage::from_fn(1100, 1000, |_, _| {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        let b = seed.to_le_bytes();
        image::Rgb([b[0], b[1], b[2]])
    });
    let mut big_png = Cursor::new(Vec::new());
    big_img.write_to(&mut big_png, image::ImageFormat::Png).unwrap();
    assert!((3 * 1024 * 1024 + 1..3_400_000).contains(&big_png.get_ref().len()));
    let big_png_url = format!("data:image/png;base64,{}", STANDARD.encode(big_png.into_inner()));
    let mut too_big_logo = base_snapshot();
    too_big_logo["schools"][0]["logoDataUrl"] = json!(big_png_url.clone());
    assert!(store.commit(0, &too_big_logo.to_string()).is_err());

    // 4) Geçerli logo ve >3 MiB okul resmi decode edilip media/originals/schools altında DPAPI ile saklanır;
    //    SQLite kaydında base64 kalmaz, yalnız "marbleos-school-asset:<uuid>" referansı tutulur.
    let mut snap = base_snapshot();
    snap["schools"][0]["logoDataUrl"] = json!(valid_png);
    snap["schools"][0]["schoolPhotoDataUrl"] = json!(big_png_url);
    snap["photos"] = json!([photo(PHOTO, &valid_png)]);
    let saved = store.commit(0, &snap.to_string()).unwrap();
    let persisted: Value = serde_json::from_str(&saved.snapshot_json.unwrap()).unwrap();
    let logo_ref = persisted["schools"][0]["logoDataUrl"].as_str().unwrap().to_owned();
    let cover_ref = persisted["schools"][0]["schoolPhotoDataUrl"].as_str().unwrap().to_owned();
    let logo_id = logo_ref.strip_prefix("marbleos-school-asset:").unwrap();
    let cover_id = cover_ref.strip_prefix("marbleos-school-asset:").unwrap();
    assert_ne!(logo_id, cover_id);
    assert_eq!(store.original(logo_id, None).unwrap(), valid_png);
    assert_eq!(store.original(cover_id, None).unwrap(), big_png_url);
    assert!(store.preview(logo_id).unwrap().starts_with("data:image/png;base64,"));

    // 5) Öğrenci fotoğrafının kimliği okul görseli referansı olarak sızdırılamaz.
    let mut cross = persisted.clone();
    cross["schools"][0]["deputySignatureDataUrl"] = json!(format!("marbleos-school-asset:{PHOTO}"));
    assert!(store.commit(1, &cross.to_string()).is_err());

    // 6) Okul birleştirmede paylaşılan okul görseli ve kopyalanan öğrenci fotoğrafı ("marbleos-photo-copy:<id>")
    //    doğrulanır; okul görseli kimliği öğrenci kopyası olarak sızdırılamaz.
    let mut bad_copy = persisted.clone();
    bad_copy["photos"].as_array_mut().unwrap().push(photo(SECOND_PHOTO, &format!("marbleos-photo-copy:{logo_id}")));
    assert!(store.commit(1, &bad_copy.to_string()).is_err());

    let mut shared = persisted.clone();
    let mut second_school = school(SECOND_PHOTO, "00002", "");
    second_school["name"] = json!("Birleşik Okul");
    second_school["logoDataUrl"] = json!(logo_ref.clone());
    shared["schools"].as_array_mut().unwrap().push(second_school);
    let cloned_photo_id = "22222222-3333-4444-8555-666666666666";
    shared["photos"].as_array_mut().unwrap().push(photo(cloned_photo_id, &format!("marbleos-photo-copy:{PHOTO}")));
    let saved2 = store.commit(1, &shared.to_string()).unwrap();
    assert_eq!(store.original(cloned_photo_id, None).unwrap(), valid_png);
    let mut after_first_clear: Value = serde_json::from_str(&saved2.snapshot_json.unwrap()).unwrap();
    after_first_clear["schools"][0]["logoDataUrl"] = json!("");
    let saved3 = store.commit(2, &after_first_clear.to_string()).unwrap();
    assert_eq!(store.original(logo_id, None).unwrap(), valid_png);

    // 7) Son okul da logoyu yenileyip kapak resmini sildiğinde eski .dpapi dosyaları diskten temizlenir.
    let mut replaced: Value = serde_json::from_str(&saved3.snapshot_json.unwrap()).unwrap();
    replaced["schools"].as_array_mut().unwrap().pop();
    replaced["schools"][0]["logoDataUrl"] = json!(valid_png);
    replaced["schools"][0]["schoolPhotoDataUrl"] = json!("");
    let saved4 = store.commit(3, &replaced.to_string()).unwrap();
    assert!(store.original(logo_id, None).is_err());
    assert!(store.original(cover_id, None).is_err());
    let persisted4: Value = serde_json::from_str(&saved4.snapshot_json.unwrap()).unwrap();
    let new_logo_id = persisted4["schools"][0]["logoDataUrl"]
        .as_str().unwrap().strip_prefix("marbleos-school-asset:").unwrap();
    assert_eq!(store.original(new_logo_id, None).unwrap(), valid_png);
    assert_eq!(fs::read_dir(store.root.join("media/originals/schools")).unwrap().count(), 1);
    assert_eq!(fs::read_dir(store.root.join("media/previews/schools")).unwrap().count(), 1);
}

#[test]
fn legacy_inline_school_visuals_migrate_to_managed_files_on_load() {
    let (_folder, store) = test_store();
    let (valid_png, _) = png_data();
    let conn = store.connect().unwrap();
    let mut legacy = base_snapshot();
    legacy["schools"][0]["logoDataUrl"] = json!(valid_png);
    let legacy_json = legacy.to_string();
    let encrypted = crypto::seal(legacy_json.as_bytes(), snapshot_scope(1).as_bytes()).unwrap();
    conn.execute(
        "INSERT INTO workspace (id, revision, encrypted_snapshot) VALUES (1, 1, ?1)",
        [encrypted],
    ).unwrap();
    drop(conn);

    let loaded = store.load().unwrap();
    assert_eq!(loaded.revision, 2);
    let migrated: Value = serde_json::from_str(&loaded.snapshot_json.unwrap()).unwrap();
    let logo_ref = migrated["schools"][0]["logoDataUrl"].as_str().unwrap();
    let asset_id = logo_ref.strip_prefix("marbleos-school-asset:").unwrap();
    assert_eq!(store.original(asset_id, None).unwrap(), valid_png);
}

#[test]
fn recovery_key_rotates_and_unlocks_vault_after_windows_dpapi_profile_loss() {
    let (_folder, store) = test_store();
    let (valid_png, _) = png_data();
    let mut snap = base_snapshot();
    snap["schools"][0]["logoDataUrl"] = json!(valid_png);
    snap["photos"] = json!([photo(PHOTO, &valid_png)]);
    let committed = store.commit(0, &snap.to_string()).unwrap();
    assert!(!committed.vault.locked && !committed.vault.has_recovery_key);
    let persisted: Value = serde_json::from_str(committed.snapshot_json.as_deref().unwrap()).unwrap();
    let logo_id = persisted["schools"][0]["logoDataUrl"]
        .as_str().unwrap().strip_prefix("marbleos-school-asset:").unwrap().to_owned();

    // 1) İlk 256-bit (7x8 = 56 karakter) kurtarma anahtarı üretilir; onaysız üzerine yazma reddedilir.
    let first_key = store.generate_recovery_key(false).unwrap();
    assert_eq!(first_key.recovery_key.len(), 62);
    assert!(store.generate_recovery_key(false).is_err());

    // 2) Onaylı yenilemede eski anahtar geçersizleşir, yeni parmak izi kaydedilir.
    let rotated = store.generate_recovery_key(true).unwrap();
    assert_ne!(rotated.recovery_key, first_key.recovery_key);
    assert_ne!(rotated.recovery_fingerprint, first_key.recovery_fingerprint);

    // 3) Windows yeniden kurulumu simülasyonu: DPAPI sargısı bu oturumda açılamaz hale getirilir.
    let conn = store.connect().unwrap();
    let broken_dpapi = crypto::seal(&[9u8; 32], b"farkli-windows-kullanicisi").unwrap();
    conn.execute("UPDATE vault_key SET dpapi_wrapped_dek = ?1 WHERE id = 1", [broken_dpapi]).unwrap();
    drop(conn);

    let reopened = StudioStorage::new(store.root.clone());
    let locked_state = reopened.load().unwrap();
    assert!(locked_state.vault.locked);
    assert!(locked_state.vault.has_recovery_key);
    assert_eq!(locked_state.vault.recovery_fingerprint.as_deref(), Some(rotated.recovery_fingerprint.as_str()));
    assert!(locked_state.snapshot_json.is_none());

    // Kilitliyken yazma, önizleme, orijinal okuma ve yeni anahtar üretme reddedilir.
    assert!(reopened.commit(1, committed.snapshot_json.as_deref().unwrap()).is_err());
    assert!(reopened.preview(PHOTO).is_err());
    assert!(reopened.original(&logo_id, None).is_err());
    assert!(reopened.generate_recovery_key(true).is_err());

    // 4) Yazım hatalı anahtar, eski (yenilenmiş) anahtar ve sahte 256-bit anahtar reddedilir.
    let mut typo = rotated.recovery_key.clone();
    typo.replace_range(0..1, if &typo[0..1] == "A" { "B" } else { "A" });
    assert!(reopened.unlock_with_recovery_key(&typo).is_err());
    assert!(reopened.unlock_with_recovery_key(&first_key.recovery_key).is_err());
    let forged = vault::encode_recovery_key(&[0x5a; 32]);
    assert!(reopened.unlock_with_recovery_key(&forged).is_err());
    assert!(reopened.load().unwrap().vault.locked);

    // 5) Doğru kurtarma anahtarı (küçük harf ve boşluklu girilse bile) Argon2id + AES-256-GCM ile DEK'i açar
    //    ve yeni Windows kullanıcısının DPAPI anahtarına yeniden bağlar.
    let messy_input = rotated.recovery_key.to_ascii_lowercase().replace('-', "  ");
    let unlocked = reopened.unlock_with_recovery_key(&messy_input).unwrap();
    assert!(!unlocked.vault.locked);
    assert_eq!(unlocked.snapshot_json, committed.snapshot_json);
    assert_eq!(reopened.original(PHOTO, None).unwrap(), valid_png);
    assert_eq!(reopened.original(&logo_id, None).unwrap(), valid_png);
    assert!(!reopened.load().unwrap().vault.locked);
}

#[test]
fn legacy_dpapi_workspace_and_photos_upgrade_to_dek_and_survive_profile_loss() {
    let (_folder, store) = test_store();
    let (valid_png, png_bytes) = png_data();
    let conn = store.connect().unwrap();
    let mut legacy = base_snapshot();
    legacy["photos"] = json!([photo(PHOTO, "")]);
    let legacy_dpapi_ws = crypto::seal(legacy.to_string().as_bytes(), snapshot_scope(1).as_bytes()).unwrap();
    conn.execute("INSERT INTO workspace (id, revision, encrypted_snapshot) VALUES (1, 1, ?1)", [legacy_dpapi_ws]).unwrap();
    conn.execute("INSERT INTO assets (id, folder) VALUES (?1, NULL)", [PHOTO]).unwrap();
    fs::write(
        store.root.join("media/originals").join(format!("{PHOTO}.dpapi")),
        crypto::seal(&png_bytes, format!("marbleos-studio:originals:v1:{PHOTO}").as_bytes()).unwrap(),
    ).unwrap();
    fs::write(
        store.root.join("media/previews").join(format!("{PHOTO}.dpapi")),
        crypto::seal(&png_bytes, format!("marbleos-studio:previews:v1:{PHOTO}").as_bytes()).unwrap(),
    ).unwrap();
    drop(conn);

    // İlk yüklemede hem SQLite kaydı hem eski .dpapi fotoğraf dosyaları MBLAEAD1 (DEK) zarfına yükseltilir.
    assert_eq!(store.load().unwrap().revision, 1);
    let rk = store.generate_recovery_key(false).unwrap();
    let upgraded_file = fs::read(store.root.join("media/originals").join(format!("{PHOTO}.dpapi"))).unwrap();
    assert!(crypto::is_aead_blob(&upgraded_file));

    // Windows profili kaybolsa bile yükseltilmiş eski fotoğraf kurtarma anahtarıyla açılır.
    let conn = store.connect().unwrap();
    let broken_dpapi = crypto::seal(&[7u8; 32], b"yeni-windows").unwrap();
    conn.execute("UPDATE vault_key SET dpapi_wrapped_dek = ?1 WHERE id = 1", [broken_dpapi]).unwrap();
    drop(conn);

    assert!(store.load().unwrap().vault.locked);
    store.unlock_with_recovery_key(&rk.recovery_key).unwrap();
    assert_eq!(store.original(PHOTO, None).unwrap(), valid_png);
}

#[test]
fn legacy_migration_rejects_an_asset_id_that_escapes_the_media_folder() {
    let (_folder, store) = test_store();
    let conn = store.connect().unwrap();
    let file_stem = "a".repeat(30);
    let invalid_id = format!("../../{file_stem}");
    let escaped = store.root.join(format!("{file_stem}.dpapi"));
    fs::write(&escaped, crypto::AEAD_MAGIC).unwrap();
    conn.execute("INSERT INTO assets (id) VALUES (?1)", [&invalid_id]).unwrap();

    assert!(store.load().is_err());
    assert_eq!(fs::read(escaped).unwrap().as_slice(), crypto::AEAD_MAGIC);
    let saved_id: String = conn.query_row("SELECT id FROM assets", [], |row| row.get(0)).unwrap();
    assert_eq!(saved_id, invalid_id);
}

#[test]
fn legacy_migration_reads_workspace_after_a_concurrent_writer_commits() {
    use std::sync::{mpsc, OnceLock};

    static MIGRATION_BLOCKED: OnceLock<mpsc::Sender<()>> = OnceLock::new();

    let (_folder, store) = test_store();
    let mut conn = store.connect().unwrap();
    let VaultOpenOutcome::Unlocked(dek, _) = store.open_vault(&mut conn).unwrap() else {
        panic!("test vault should be unlocked");
    };
    let legacy = base_snapshot().to_string();
    let legacy_blob = crypto::seal(legacy.as_bytes(), snapshot_scope(1).as_bytes()).unwrap();
    conn.execute("INSERT INTO workspace VALUES (1, 1, ?1)", [legacy_blob]).unwrap();

    let mut newer = base_snapshot();
    newer["albumConfig"]["headerTitle"] = json!("Yeni sürüm");
    let newer = newer.to_string();
    let newer_blob = crypto::seal_with_key(&dek, newer.as_bytes(), snapshot_scope(2).as_bytes()).unwrap();
    let mut reader = store.connect().unwrap();
    let (blocked_tx, blocked_rx) = mpsc::channel();
    assert!(MIGRATION_BLOCKED.set(blocked_tx).is_ok());
    reader.busy_handler(Some(|attempt| {
        if attempt == 0 {
            let _ = MIGRATION_BLOCKED.get().unwrap().send(());
        }
        std::thread::sleep(Duration::from_millis(10));
        attempt < 500
    })).unwrap();

    let writer = conn.transaction_with_behavior(TransactionBehavior::Immediate).unwrap();
    writer.execute("UPDATE workspace SET revision = 2, encrypted_snapshot = ?1", [newer_blob]).unwrap();
    let migrating_store = store.clone();
    let migration = std::thread::spawn(move || migrating_store.migrate_legacy_dpapi(&mut reader, &dek));
    blocked_rx.recv_timeout(Duration::from_secs(5)).unwrap();
    writer.commit().unwrap();

    migration.join().unwrap().unwrap();
    let loaded = store.load().unwrap();
    assert_eq!(loaded.revision, 2);
    assert_eq!(loaded.snapshot_json.as_deref(), Some(newer.as_str()));
}

#[test]
fn exif_oriented_jpeg_rotates_preview_upright_without_mutating_original_bytes() {
    use sha2::{Digest, Sha256};

    let (_folder, store) = test_store();
    let raw_img = image::RgbImage::from_fn(40, 20, |x, _| {
        if x < 20 { image::Rgb([220, 40, 60]) } else { image::Rgb([40, 120, 220]) }
    });
    let mut jpeg_buf = Cursor::new(Vec::new());
    raw_img.write_to(&mut jpeg_buf, image::ImageFormat::Jpeg).unwrap();
    let raw_jpeg = jpeg_buf.into_inner();
    assert_eq!(&raw_jpeg[..2], &[0xFF, 0xD8]);

    // EXIF APP1 segmenti: Little-Endian TIFF ("II*\0"), IFD0 tek girdi (Tag 0x0112 = Orientation 6 / 90° CW)
    let exif_payload: [u8; 32] = [
        b'E', b'x', b'i', b'f', 0, 0,
        b'I', b'I', 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ];
    let seg_len = (exif_payload.len() + 2) as u16;
    let mut exif_jpeg = Vec::with_capacity(raw_jpeg.len() + exif_payload.len() + 4);
    exif_jpeg.extend_from_slice(&[0xFF, 0xD8, 0xFF, 0xE1]);
    exif_jpeg.extend_from_slice(&seg_len.to_be_bytes());
    exif_jpeg.extend_from_slice(&exif_payload);
    exif_jpeg.extend_from_slice(&raw_jpeg[2..]);

    let expected_hash = format!("{:x}", Sha256::digest(&exif_jpeg));
    let data_url = format!("data:image/jpeg;base64,{}", STANDARD.encode(&exif_jpeg));
    let mut snap = base_snapshot();
    let mut p = photo(PHOTO, &data_url);
    p["contentHash"] = json!(expected_hash);
    snap["photos"] = json!([p]);

    store.commit(0, &snap.to_string()).unwrap();
    assert_eq!(store.original(PHOTO, Some(&expected_hash)).unwrap(), data_url);

    let preview_url = store.preview(PHOTO).unwrap();
    let preview_bytes = STANDARD.decode(preview_url.strip_prefix("data:image/png;base64,").unwrap()).unwrap();
    let preview_img = image::load_from_memory(&preview_bytes).unwrap();
    assert_eq!((preview_img.width(), preview_img.height()), (20, 40));
}

#[test]
fn managed_export_validates_subfolder_filename_magic_and_vault_lock() {
    let (_folder, store) = test_store();
    let pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n";
    let pdf_b64 = STANDARD.encode(pdf_bytes);

    let saved = store.save_export("vesikalik", "4-A_vesikalik_300dpi.pdf", &pdf_b64).unwrap();
    assert_eq!(saved.relative_path, "exports/vesikalik/4-A_vesikalik_300dpi.pdf");
    assert_eq!(saved.byte_length, pdf_bytes.len());
    assert_eq!(
        fs::read(store.root.join("exports/vesikalik/4-A_vesikalik_300dpi.pdf")).unwrap(),
        pdf_bytes,
    );

    let long_name = format!("{}_10-A_vesikalik-45x60_10x15_kisi_karti_300dpi.pdf", "Çağdaş_Eğitim_".repeat(6));
    let long_export = store.save_export("vesikalik", &long_name, &pdf_b64).unwrap();
    assert_eq!(long_export.relative_path, format!("exports/vesikalik/{long_name}"));
    assert!(store.save_export("vesikalik", &format!("{}.pdf", "a".repeat(160)), &pdf_b64).is_err());

    // Klasör kaçışı, Windows cihaz adları, izin verilmeyen uzantı ve sahte imza reddedilir.
    assert!(store.save_export("../escape", "dosya.pdf", &pdf_b64).is_err());
    assert!(store.save_export("vesikalik", "../dosya.pdf", &pdf_b64).is_err());
    assert!(store.save_export("vesikalik", "CON.pdf", &pdf_b64).is_err());
    assert!(store.save_export("vesikalik", "zararli.exe", &pdf_b64).is_err());
    assert!(store.save_export("vesikalik", "sahte.pdf", &STANDARD.encode(b"NOT_A_PDF")).is_err());

    // Kilitli kasada dışa aktarım ve klasör açma reddedilir.
    let conn = store.connect().unwrap();
    let broken_dpapi = crypto::seal(&[9u8; 32], b"baska-profil").unwrap();
    conn.execute("UPDATE vault_key SET dpapi_wrapped_dek = ?1 WHERE id = 1", [broken_dpapi]).unwrap();
    drop(conn);
    assert!(store.save_export("vesikalik", "yeni.pdf", &pdf_b64).is_err());
    assert!(store.open_managed_dir("exports").is_err());
}

#[test]
fn persists_school_palettes_12_ink_colors_and_print_font_points_strictly() {
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    snapshot["albumConfig"]["chartTemplateId"] = json!("high-classic-32");
    snapshot["albumConfig"]["chartPaletteId"] = json!("anatolian-teal");
    snapshot["albumConfig"]["chartInkId"] = json!("obsidian-black");
    snapshot["albumConfig"]["printFontPt"] = json!(10);

    let saved = store.commit(0, &snapshot.to_string()).unwrap();
    let persisted: Value = serde_json::from_str(saved.snapshot_json.as_deref().unwrap()).unwrap();
    assert_eq!(persisted["albumConfig"]["chartPaletteId"], "anatolian-teal");
    assert_eq!(persisted["albumConfig"]["chartInkId"], "obsidian-black");
    assert_eq!(persisted["albumConfig"]["printFontPt"], 10);

    let mut bad_ink = snapshot.clone();
    bad_ink["albumConfig"]["chartInkId"] = json!("neon-orange");
    assert!(store.commit(saved.revision, &bad_ink.to_string()).is_err());

    let mut bad_palette = snapshot.clone();
    bad_palette["albumConfig"]["chartPaletteId"] = json!("unknown-palette");
    assert!(store.commit(saved.revision, &bad_palette.to_string()).is_err());
}

#[test]
fn select_school_updates_active_school_without_rewriting_snapshot_and_enforces_security() {
    let second_school_id = "c4f9b2a1-7e5d-4c8b-9a1e-2f3d4c5b6a79";
    let missing_school_id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    snapshot["schools"].as_array_mut().unwrap().push(school(second_school_id, "00002", "000456"));

    let saved = store.commit(0, &snapshot.to_string()).unwrap();
    assert_eq!(saved.revision, 1);

    let conn = store.connect().unwrap();
    let original_blob: Vec<u8> = conn
        .query_row("SELECT encrypted_snapshot FROM workspace WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    drop(conn);

    // 1) Hızlı okul seçimi revizyonu artırır, ama büyük workspace snapshot blobunu yeniden yazmaz.
    let switched = store.select_school(1, Some(second_school_id)).unwrap();
    assert_eq!(switched.revision, 2);
    assert_eq!(switched.active_school_id.as_deref(), Some(second_school_id));

    let conn = store.connect().unwrap();
    let (ws_rev, after_blob): (i64, Vec<u8>) = conn
        .query_row("SELECT revision, encrypted_snapshot FROM workspace WHERE id = 1", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .unwrap();
    assert_eq!(ws_rev, 1);
    assert_eq!(after_blob, original_blob);
    drop(conn);

    // SQLite dosyasında seçili okul UUID'leri açık metin görünmez.
    let db_bytes = fs::read(store.root.join("data/marbleos_studio.db")).unwrap();
    assert!(!db_bytes.windows(second_school_id.len()).any(|w| w == second_school_id.as_bytes()));

    // 2) Yeniden açılışta seçili okul ve yeni revizyon korunur.
    let reopened = StudioStorage::new(store.root.clone());
    let loaded = reopened.load().unwrap();
    assert_eq!(loaded.revision, 2);
    let loaded_json: Value = serde_json::from_str(loaded.snapshot_json.as_deref().unwrap()).unwrap();
    assert_eq!(loaded_json["activeSchoolId"], second_school_id);

    // 3) Aynı okulu tekrar seçmek no-op olarak revizyonu bozmaz.
    let noop = reopened.select_school(2, Some(second_school_id)).unwrap();
    assert_eq!(noop.revision, 2);
    assert_eq!(noop.active_school_id.as_deref(), Some(second_school_id));

    // 4) Geçersiz kimlik, bilinmeyen okul ve eski revizyon reddedilir.
    assert!(reopened.select_school(2, Some("../escape")).is_err());
    assert!(reopened.select_school(2, Some(missing_school_id)).is_err());
    assert!(reopened.select_school(1, Some(SCHOOL_ID)).is_err());

    // 5) Kurtarma anahtarıyla DPAPI profil kaybından sonra da seçili okul korunur.
    let rk = reopened.generate_recovery_key(false).unwrap();
    let conn = reopened.connect().unwrap();
    let broken_dpapi = crypto::seal(&[7u8; 32], b"baska-oturum").unwrap();
    conn.execute("UPDATE vault_key SET dpapi_wrapped_dek = ?1 WHERE id = 1", [broken_dpapi]).unwrap();
    drop(conn);
    let locked_store = StudioStorage::new(store.root.clone());
    assert!(locked_store.select_school(2, Some(SCHOOL_ID)).is_err());
    let unlocked = locked_store.unlock_with_recovery_key(&rk.recovery_key).unwrap();
    assert_eq!(unlocked.revision, 2);
    let unlocked_json: Value = serde_json::from_str(unlocked.snapshot_json.as_deref().unwrap()).unwrap();
    assert_eq!(unlocked_json["activeSchoolId"], second_school_id);

    // 6) Sonraki tam commit güncel seçim revizyonu (2) ile sorunsuz birleşir.
    let mut updated = unlocked_json;
    updated["albumConfig"]["headerTitle"] = json!("Güncel Başlık");
    let committed = locked_store.commit(2, &updated.to_string()).unwrap();
    assert_eq!(committed.revision, 3);

    // 7) Seçimi temizleme (None) de kalıcıdır.
    let cleared = locked_store.select_school(3, None).unwrap();
    assert_eq!(cleared.revision, 4);
    assert_eq!(cleared.active_school_id, None);
    let reloaded = StudioStorage::new(store.root.clone()).load().unwrap();
    assert_eq!(reloaded.revision, 4);
    let reloaded_json: Value = serde_json::from_str(reloaded.snapshot_json.as_deref().unwrap()).unwrap();
    assert!(reloaded_json["activeSchoolId"].is_null());

    // 8) workspace_selection revizyonuna müdahale AEAD AAD kontrolünden geçemez.
    let conn = locked_store.connect().unwrap();
    conn.execute("UPDATE workspace_selection SET selection_revision = 9 WHERE id = 1", []).unwrap();
    drop(conn);
    assert!(StudioStorage::new(store.root.clone()).load().is_err());
    assert!(locked_store.select_school(9, Some(SCHOOL_ID)).is_err());
}

#[test]
fn select_school_lazily_initializes_selection_row_for_upgraded_databases() {
    let second_school_id = "c4f9b2a1-7e5d-4c8b-9a1e-2f3d4c5b6a79";
    let (_folder, store) = test_store();
    let mut snapshot = base_snapshot();
    snapshot["schools"].as_array_mut().unwrap().push(school(second_school_id, "00002", "000456"));
    let saved = store.commit(0, &snapshot.to_string()).unwrap();
    assert_eq!(saved.revision, 1);

    // Eski v5 DB'den yükseltme benzetimi: workspace_selection henüz boş.
    let conn = store.connect().unwrap();
    conn.execute("DELETE FROM workspace_selection", []).unwrap();
    drop(conn);

    let switched = store.select_school(1, Some(second_school_id)).unwrap();
    assert_eq!(switched.revision, 2);
    assert_eq!(switched.active_school_id.as_deref(), Some(second_school_id));

    let loaded = StudioStorage::new(store.root.clone()).load().unwrap();
    assert_eq!(loaded.revision, 2);
    let persisted: Value = serde_json::from_str(loaded.snapshot_json.as_deref().unwrap()).unwrap();
    assert_eq!(persisted["activeSchoolId"], second_school_id);
}
