use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_document_text,
            list_documents,
            rename_document,
            delete_document,
            get_document_chunks,
            ask_document_question,
            generate_study_items,
            get_runtime_config,
            save_runtime_config,
            build_vector_index,
            validate_tts_setup,
            validate_tts_config,
            get_runtime_defaults,
            speak_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ImportedDocument {
    id: String,
    name: String,
    file_type: String,
    file_size: u64,
    character_count: usize,
    chunk_count: usize,
    persisted: bool,
    chunks: Vec<DocumentChunk>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct DocumentChunk {
    id: String,
    chunk_index: usize,
    text: String,
    start_offset: usize,
    end_offset: usize,
    token_estimate: usize,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct StoredDocument {
    id: String,
    title: String,
    file_type: String,
    file_size: i64,
    chunk_count: i64,
    created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct StoredChunk {
    id: String,
    chunk_index: i32,
    text: String,
    start_offset: i32,
    end_offset: i32,
    token_estimate: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct TutorAnswer {
    answer: String,
    citations: Vec<AnswerCitation>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct AnswerCitation {
    chunk_id: String,
    chunk_index: i32,
    excerpt: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct StudyItem {
    id: String,
    kind: String,
    prompt: String,
    answer: String,
    source_chunk_id: String,
    source_chunk_index: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
struct RuntimeConfig {
    cloud_provider: String,
    cloud_api_base_url: String,
    cloud_model: String,
    cloud_api_key_env: String,
    ollama_endpoint: String,
    ollama_model: String,
    llama_binary_path: String,
    llm_model_path: String,
    piper_binary_path: String,
    piper_voice_path: String,
    faiss_index_dir: String,
}

#[derive(serde::Serialize)]
struct IndexResult {
    document_id: String,
    embedding_count: usize,
    dimension: usize,
    index_path: String,
}

#[derive(serde::Serialize)]
struct SpeechResult {
    audio_path: String,
    engine: String,
}

#[derive(serde::Serialize)]
struct TtsStatus {
    piper_binary_exists: bool,
    piper_voice_exists: bool,
    piper_voice_config_exists: bool,
    piper_ready: bool,
    windows_tts_available: bool,
    recommended_voice_dir: String,
    messages: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct LocalLibrary {
    documents: Vec<StoredDocument>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct LocalDocumentRecord {
    document: StoredDocument,
    chunks: Vec<StoredChunk>,
}

#[tauri::command]
fn import_document_text(
    name: String,
    file_type: String,
    file_size: u64,
    text: String,
) -> Result<ImportedDocument, String> {
    let normalized = normalize_text(&text);

    if normalized.trim().is_empty() {
        return Err("The selected document did not contain readable text yet.".to_string());
    }

    let document_id = create_id("doc", &name);
    let chunks = chunk_text(&document_id, &normalized, 1400, 220);
    let persisted = persist_document(&document_id, &name, &file_type, file_size, &chunks)?;
    let _ = persist_embeddings(&document_id, &chunks);

    Ok(ImportedDocument {
        id: document_id,
        name,
        file_type,
        file_size,
        character_count: normalized.chars().count(),
        chunk_count: chunks.len(),
        persisted,
        chunks,
    })
}

#[tauri::command]
fn list_documents() -> Result<Vec<StoredDocument>, String> {
    Ok(load_library()?.documents)
}

#[tauri::command]
fn rename_document(document_id: String, title: String) -> Result<StoredDocument, String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("Document title cannot be empty.".to_string());
    }

    let mut library = load_library()?;
    let Some(document) = library
        .documents
        .iter_mut()
        .find(|document| document.id == document_id)
    else {
        return Err("Document was not found in the local library.".to_string());
    };

    document.title = trimmed.to_string();
    let updated = document.clone();
    write_json(&library_path(), &library)?;

    let path = document_record_path(&document_id);
    if path.exists() {
        let mut record = read_json::<LocalDocumentRecord>(&path)?;
        record.document.title = trimmed.to_string();
        write_json(&path, &record)?;
    }

    Ok(updated)
}

#[tauri::command]
fn delete_document(document_id: String) -> Result<(), String> {
    let mut library = load_library()?;
    library
        .documents
        .retain(|document| document.id != document_id);
    write_json(&library_path(), &library)?;

    let path = document_record_path(&document_id);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Failed to delete local document file: {error}"))?;
    }

    let index_path = default_index_dir().join(format!("{document_id}.jsonl"));
    if index_path.exists() {
        let _ = fs::remove_file(index_path);
    }

    Ok(())
}

#[tauri::command]
fn get_document_chunks(document_id: String) -> Result<Vec<StoredChunk>, String> {
    load_chunks(&document_id)
}

#[tauri::command]
fn ask_document_question(
    document_id: String,
    question: String,
    learner_age: Option<u8>,
) -> Result<TutorAnswer, String> {
    let chunks = load_chunks(&document_id)?;
    let terms = search_terms(&question);

    if terms.is_empty() {
        return Err("Ask a more specific question so I can search the document.".to_string());
    }

    let query_vector = embed_text(&question);
    let mut scored = chunks
        .into_iter()
        .map(|chunk| {
            let vector_score = cosine_similarity(&query_vector, &embed_text(&chunk.text));
            let score = (retrieval_score(&question, &chunk.text) * 0.35) + (vector_score * 0.65);
            (score, chunk)
        })
        .filter(|(score, _)| *score > 0.0)
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| {
        right
            .0
            .partial_cmp(&left.0)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let scored_citations = scored
        .into_iter()
        .take(3)
        .map(|(score, chunk)| {
            (
                score,
                AnswerCitation {
                    excerpt: excerpt(&chunk.text, 360),
                    chunk_id: chunk.id,
                    chunk_index: chunk.chunk_index,
                },
            )
        })
        .collect::<Vec<_>>();

    let top_score = scored_citations
        .first()
        .map(|(score, _)| *score)
        .unwrap_or(0.0);
    let citations = scored_citations
        .into_iter()
        .map(|(_, citation)| citation)
        .collect::<Vec<_>>();

    if citations.is_empty() || top_score < 0.04 {
        return Ok(TutorAnswer {
            answer: "This question does not have a strong match with the uploaded document. I can help when the question stays on the same subject or topic as the document.".to_string(),
            citations,
        });
    }

    let answer = synthesize_answer(&question, &citations, learner_age).unwrap_or_else(|| {
        let joined = citations
            .iter()
            .map(|citation| citation.excerpt.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");
        let age_note = learner_age
            .map(|age| format!(" I will explain it in a way that fits a {age} year old learner."))
            .unwrap_or_default();
        format!(
            "This question matches the document topic.{age_note} I found {} relevant source chunk{}. Based on the retrieved material: {}",
            citations.len(),
            if citations.len() == 1 { "" } else { "s" },
            excerpt(&joined, 700)
        )
    });

    Ok(TutorAnswer { answer, citations })
}

#[tauri::command]
fn generate_study_items(document_id: String) -> Result<Vec<StudyItem>, String> {
    let chunks = load_chunks(&document_id)?;

    Ok(chunks
        .into_iter()
        .take(12)
        .enumerate()
        .map(|(index, chunk)| {
            let lead = first_sentence(&chunk.text);
            StudyItem {
                id: format!("study-{}-{index}", chunk.id),
                kind: if index % 2 == 0 {
                    "flashcard".to_string()
                } else {
                    "quiz".to_string()
                },
                prompt: if index % 2 == 0 {
                    format!("Explain this key idea: {}", excerpt(&lead, 120))
                } else {
                    format!(
                        "Which statement is best supported by chunk {}?",
                        chunk.chunk_index + 1
                    )
                },
                answer: excerpt(&chunk.text, 420),
                source_chunk_id: chunk.id,
                source_chunk_index: chunk.chunk_index,
            }
        })
        .collect())
}

#[tauri::command]
fn get_runtime_config() -> Result<RuntimeConfig, String> {
    let mut config = default_runtime_config();
    merge_runtime_config(&mut config, load_runtime_defaults()?);

    if runtime_config_path().exists() {
        let saved = read_json::<RuntimeConfig>(&runtime_config_path())?;
        merge_runtime_config(&mut config, saved);
    }

    Ok(config)
}

#[tauri::command]
fn get_runtime_defaults() -> Result<RuntimeConfig, String> {
    let mut config = default_runtime_config();
    merge_runtime_config(&mut config, load_runtime_defaults()?);
    Ok(config)
}

#[tauri::command]
fn save_runtime_config(config: RuntimeConfig) -> Result<RuntimeConfig, String> {
    write_json(&runtime_config_path(), &config)?;
    Ok(config)
}

#[tauri::command]
fn build_vector_index(document_id: String) -> Result<IndexResult, String> {
    let chunks = load_chunks(&document_id)?
        .into_iter()
        .map(|chunk| DocumentChunk {
            id: chunk.id,
            chunk_index: chunk.chunk_index as usize,
            text: chunk.text,
            start_offset: chunk.start_offset as usize,
            end_offset: chunk.end_offset as usize,
            token_estimate: chunk.token_estimate as usize,
        })
        .collect::<Vec<_>>();

    let result = persist_embeddings(&document_id, &chunks)?;
    Ok(result)
}

#[tauri::command]
fn validate_tts_setup() -> Result<TtsStatus, String> {
    let config = get_runtime_config()?;
    Ok(build_tts_status(&config))
}

#[tauri::command]
fn validate_tts_config(config: RuntimeConfig) -> Result<TtsStatus, String> {
    Ok(build_tts_status(&config))
}

#[tauri::command]
fn speak_text(text: String, speed: Option<f32>) -> Result<SpeechResult, String> {
    let config = get_runtime_config()?;
    let status = build_tts_status(&config);
    let speed = speed.unwrap_or(1.0).clamp(0.5, 2.0);

    if !status.piper_ready {
        speak_with_windows_tts(&text, speed)?;
        return Ok(SpeechResult {
            audio_path: "windows-native-tts".to_string(),
            engine: "windows-native".to_string(),
        });
    }

    let binary = Path::new(&config.piper_binary_path);
    let voice = Path::new(&config.piper_voice_path);
    let output_dir = default_audio_dir();
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Failed to create TTS output directory: {error}"))?;
    let audio_path = output_dir.join(format!("echolearn-{}.wav", timestamp_millis()));

    let mut child = Command::new(binary)
        .arg("--model")
        .arg(voice)
        .arg("--length_scale")
        .arg(format!("{:.2}", 1.0 / speed))
        .arg("--output_file")
        .arg(&audio_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start Piper: {error}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|error| format!("Failed to send text to Piper: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Failed while running Piper: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Piper failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(SpeechResult {
        audio_path: audio_path.to_string_lossy().to_string(),
        engine: "piper".to_string(),
    })
}

fn build_tts_status(config: &RuntimeConfig) -> TtsStatus {
    let binary = Path::new(config.piper_binary_path.trim());
    let voice = Path::new(config.piper_voice_path.trim());
    let voice_config_path = voice_config_path(voice);
    let piper_binary_exists = !config.piper_binary_path.trim().is_empty() && binary.exists();
    let piper_voice_exists = !config.piper_voice_path.trim().is_empty() && voice.exists();
    let piper_voice_config_exists = piper_voice_exists && voice_config_path.exists();
    let piper_ready = piper_binary_exists && piper_voice_exists && piper_voice_config_exists;
    let windows_tts_available = cfg!(target_os = "windows");
    let mut messages = Vec::new();

    if piper_ready {
        messages.push("Piper is ready: binary, voice, and voice config were found.".to_string());
    } else {
        if !piper_binary_exists {
            messages.push("Piper binary is missing or the path is empty.".to_string());
        }
        if !piper_voice_exists {
            messages.push("Piper .onnx voice model is missing or the path is empty.".to_string());
        }
        if piper_voice_exists && !piper_voice_config_exists {
            messages.push(format!(
                "Piper voice config is missing. Expected: {}",
                voice_config_path.to_string_lossy()
            ));
        }
        if windows_tts_available {
            messages.push("Windows native TTS fallback is available.".to_string());
        }
    }

    TtsStatus {
        piper_binary_exists,
        piper_voice_exists,
        piper_voice_config_exists,
        piper_ready,
        windows_tts_available,
        recommended_voice_dir: default_piper_voice_dir().to_string_lossy().to_string(),
        messages,
    }
}

fn voice_config_path(voice_path: &Path) -> PathBuf {
    let mut path = voice_path.to_path_buf();
    let file_name = voice_path
        .file_name()
        .map(|name| format!("{}.json", name.to_string_lossy()))
        .unwrap_or_else(|| "voice.onnx.json".to_string());
    path.set_file_name(file_name);
    path
}

fn speak_with_windows_tts(text: &str, speed: f32) -> Result<(), String> {
    if !cfg!(target_os = "windows") {
        return Err(
            "Piper is not configured and native TTS fallback is only available on Windows."
                .to_string(),
        );
    }

    let rate = ((speed - 1.0) * 10.0).round().clamp(-8.0, 8.0) as i32;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg("Add-Type -AssemblyName System.Speech; $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.Rate = [int]$env:ECHOLEARN_TTS_RATE; $speaker.Speak($env:ECHOLEARN_TTS_TEXT)")
        .env("ECHOLEARN_TTS_TEXT", text)
        .env("ECHOLEARN_TTS_RATE", rate.to_string())
        .output()
        .map_err(|error| format!("Failed to start Windows native TTS: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Windows native TTS failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn load_chunks(document_id: &str) -> Result<Vec<StoredChunk>, String> {
    let path = document_record_path(document_id);
    if !path.exists() {
        return Ok(Vec::new());
    }

    Ok(read_json::<LocalDocumentRecord>(&path)?.chunks)
}

fn persist_embeddings(document_id: &str, chunks: &[DocumentChunk]) -> Result<IndexResult, String> {
    let config = get_runtime_config().unwrap_or_default();
    let index_dir = if config.faiss_index_dir.trim().is_empty() {
        default_index_dir()
    } else {
        PathBuf::from(config.faiss_index_dir)
    };
    fs::create_dir_all(&index_dir)
        .map_err(|error| format!("Failed to create vector index directory: {error}"))?;

    let index_path = index_dir.join(format!("{document_id}.jsonl"));
    let mut index_file = File::create(&index_path)
        .map_err(|error| format!("Failed to create vector index export: {error}"))?;

    for chunk in chunks {
        let vector = embed_text(&chunk.text);
        let export_row = serde_json::json!({
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "model_id": "echolearn-hash-384",
            "vector": vector,
        });
        writeln!(index_file, "{export_row}")
            .map_err(|error| format!("Failed to write vector index export: {error}"))?;
    }

    Ok(IndexResult {
        document_id: document_id.to_string(),
        embedding_count: chunks.len(),
        dimension: EMBEDDING_DIMENSION,
        index_path: index_path.to_string_lossy().to_string(),
    })
}

fn persist_document(
    document_id: &str,
    name: &str,
    file_type: &str,
    file_size: u64,
    chunks: &[DocumentChunk],
) -> Result<bool, String> {
    let document = StoredDocument {
        id: document_id.to_string(),
        title: name.to_string(),
        file_type: file_type.to_string(),
        file_size: file_size as i64,
        chunk_count: chunks.len() as i64,
        created_at: timestamp_millis().to_string(),
    };
    let stored_chunks = chunks
        .iter()
        .map(|chunk| StoredChunk {
            id: chunk.id.clone(),
            chunk_index: chunk.chunk_index as i32,
            text: chunk.text.clone(),
            start_offset: chunk.start_offset as i32,
            end_offset: chunk.end_offset as i32,
            token_estimate: chunk.token_estimate as i32,
        })
        .collect::<Vec<_>>();
    let record = LocalDocumentRecord {
        document: document.clone(),
        chunks: stored_chunks,
    };

    write_json(&document_record_path(document_id), &record)?;

    let mut library = load_library()?;
    library.documents.retain(|item| item.id != document.id);
    library.documents.insert(0, document);
    library.documents.truncate(100);
    write_json(&library_path(), &library)?;

    Ok(true)
}

const EMBEDDING_DIMENSION: usize = 384;

fn embed_text(text: &str) -> Vec<f32> {
    let mut vector = vec![0.0; EMBEDDING_DIMENSION];
    for term in search_terms(text) {
        let index = stable_hash(&term) as usize % EMBEDDING_DIMENSION;
        vector[index] += 1.0;
    }
    normalize_vector(vector)
}

fn stable_hash(value: &str) -> u64 {
    let mut hash = 14_695_981_039_346_656_037u64;
    for byte in value.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1_099_511_628_211);
    }
    hash
}

fn normalize_vector(mut vector: Vec<f32>) -> Vec<f32> {
    let magnitude = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
    if magnitude > 0.0 {
        for value in &mut vector {
            *value /= magnitude;
        }
    }
    vector
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> f32 {
    left.iter()
        .zip(right.iter())
        .map(|(a, b)| a * b)
        .sum::<f32>()
        .max(0.0)
}

fn synthesize_answer(
    question: &str,
    citations: &[AnswerCitation],
    learner_age: Option<u8>,
) -> Option<String> {
    let config = get_runtime_config().ok()?;
    let evidence = citations
        .iter()
        .map(|citation| format!("[chunk {}] {}", citation.chunk_index + 1, citation.excerpt))
        .collect::<Vec<_>>()
        .join("\n");
    let learner_level = learner_age
        .map(|age| format!("Explain for a learner who is {age} years old."))
        .unwrap_or_else(|| "Explain clearly for a general learner.".to_string());
    let prompt = format!(
        "You are EchoLearn AI. First verify that the question has a strong topic match with the uploaded document evidence. If it does not, say: This question does not have a strong match with the uploaded document. I can help when the question stays on the same subject or topic as the document.\n\nIf it matches, answer the question using the evidence as the anchor. You may add brief outside explanation, examples, or simpler wording only when it helps the learner understand the same topic. Do not change subjects. {learner_level}\n\nQuestion: {question}\n\nDocument evidence:\n{evidence}\n\nAnswer:"
    );

    if let Some(answer) = synthesize_with_ollama(&config, &prompt) {
        return Some(answer);
    }

    if config.llama_binary_path.trim().is_empty() || config.llm_model_path.trim().is_empty() {
        return None;
    }

    let binary = Path::new(&config.llama_binary_path);
    let model = Path::new(&config.llm_model_path);
    if !binary.exists() || !model.exists() {
        return None;
    }

    let output = Command::new(binary)
        .arg("-m")
        .arg(model)
        .arg("-p")
        .arg(prompt)
        .arg("-n")
        .arg("220")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(excerpt(&text, 1200))
    }
}

fn synthesize_with_ollama(config: &RuntimeConfig, prompt: &str) -> Option<String> {
    if config.ollama_model.trim().is_empty() {
        return None;
    }

    let trimmed_endpoint = config.ollama_endpoint.trim().trim_end_matches('/');
    let endpoint = trimmed_endpoint
        .strip_prefix("http://")
        .unwrap_or(trimmed_endpoint);
    let (host_port, base_path) = endpoint
        .split_once('/')
        .map(|(host, path)| (host, format!("/{path}")))
        .unwrap_or((endpoint, String::new()));
    let (host, port) = host_port
        .split_once(':')
        .map(|(host, port)| (host, port.parse::<u16>().ok().unwrap_or(11434)))
        .unwrap_or((host_port, 11434));

    let body = serde_json::json!({
        "model": config.ollama_model,
        "prompt": prompt,
        "stream": false,
        "options": {
            "num_predict": 220,
            "temperature": 0.2
        }
    })
    .to_string();

    let path = format!("{base_path}/api/generate");
    let request = format!(
        "POST {path} HTTP/1.1\r\nHost: {host}:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );

    let mut stream = TcpStream::connect((host, port)).ok()?;
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let json_start = response.find("\r\n\r\n").map(|index| index + 4)?;
    let response_body = &response[json_start..];
    let value = serde_json::from_str::<serde_json::Value>(response_body).ok()?;
    let text = value.get("response")?.as_str()?.trim();
    if text.is_empty() {
        None
    } else {
        Some(excerpt(text, 1200))
    }
}

fn default_index_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data")
        .join("faiss")
}

fn app_data_dir() -> PathBuf {
    std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("EchoLearnAI")
}

fn library_dir() -> PathBuf {
    app_data_dir().join("library")
}

fn library_path() -> PathBuf {
    library_dir().join("library.json")
}

fn runtime_config_path() -> PathBuf {
    app_data_dir().join("runtime-config.json")
}

fn document_record_path(document_id: &str) -> PathBuf {
    library_dir().join(format!("{document_id}.json"))
}

fn load_library() -> Result<LocalLibrary, String> {
    let path = library_path();
    if !path.exists() {
        return Ok(LocalLibrary::default());
    }

    read_json(&path)
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;
    serde_json::from_str(&text)
        .map_err(|error| format!("Failed to parse {}: {error}", path.to_string_lossy()))
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create local storage directory {}: {error}",
                parent.to_string_lossy()
            )
        })?;
    }

    let text = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Failed to encode local data: {error}"))?;
    fs::write(path, text)
        .map_err(|error| format!("Failed to write {}: {error}", path.to_string_lossy()))
}

fn default_runtime_config() -> RuntimeConfig {
    RuntimeConfig {
        cloud_provider: std::env::var("CLOUD_LLM_PROVIDER").unwrap_or_else(|_| "none".to_string()),
        cloud_api_base_url: std::env::var("CLOUD_LLM_BASE_URL").unwrap_or_default(),
        cloud_model: std::env::var("CLOUD_LLM_MODEL").unwrap_or_default(),
        cloud_api_key_env: std::env::var("CLOUD_LLM_API_KEY_ENV").unwrap_or_default(),
        ollama_endpoint: std::env::var("OLLAMA_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:11434".to_string()),
        ollama_model: std::env::var("OLLAMA_MODEL").unwrap_or_default(),
        llama_binary_path: std::env::var("LLAMA_CPP_BIN").unwrap_or_default(),
        llm_model_path: std::env::var("LLM_MODEL_PATH").unwrap_or_default(),
        piper_binary_path: std::env::var("PIPER_BIN").unwrap_or_default(),
        piper_voice_path: std::env::var("PIPER_VOICE_PATH").unwrap_or_default(),
        faiss_index_dir: std::env::var("FAISS_INDEX_DIR")
            .unwrap_or_else(|_| default_index_dir().to_string_lossy().to_string()),
    }
}

fn load_runtime_defaults() -> Result<RuntimeConfig, String> {
    for path in runtime_defaults_candidates() {
        if path.exists() {
            return read_json::<RuntimeConfig>(&path);
        }
    }

    Ok(RuntimeConfig::default())
}

fn runtime_defaults_candidates() -> Vec<PathBuf> {
    let current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    vec![
        current.join("config").join("runtime-defaults.json"),
        current
            .join("..")
            .join("..")
            .join("config")
            .join("runtime-defaults.json"),
        app_data_dir().join("runtime-defaults.json"),
    ]
}

fn merge_runtime_config(target: &mut RuntimeConfig, source: RuntimeConfig) {
    if !source.cloud_provider.trim().is_empty() {
        target.cloud_provider = source.cloud_provider;
    }
    if !source.cloud_api_base_url.trim().is_empty() {
        target.cloud_api_base_url = source.cloud_api_base_url;
    }
    if !source.cloud_model.trim().is_empty() {
        target.cloud_model = source.cloud_model;
    }
    if !source.cloud_api_key_env.trim().is_empty() {
        target.cloud_api_key_env = source.cloud_api_key_env;
    }
    if !source.ollama_endpoint.trim().is_empty() {
        target.ollama_endpoint = source.ollama_endpoint;
    }
    if !source.ollama_model.trim().is_empty() {
        target.ollama_model = source.ollama_model;
    }
    if !source.llama_binary_path.trim().is_empty() {
        target.llama_binary_path = source.llama_binary_path;
    }
    if !source.llm_model_path.trim().is_empty() {
        target.llm_model_path = source.llm_model_path;
    }
    if !source.piper_binary_path.trim().is_empty() {
        target.piper_binary_path = source.piper_binary_path;
    }
    if !source.piper_voice_path.trim().is_empty() {
        target.piper_voice_path = source.piper_voice_path;
    }
    if !source.faiss_index_dir.trim().is_empty() {
        target.faiss_index_dir = source.faiss_index_dir;
    }
}

fn default_audio_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data")
        .join("tts")
}

fn default_piper_voice_dir() -> PathBuf {
    std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("EchoLearnAI")
        .join("models")
        .join("tts")
        .join("piper")
        .join("voices")
}

fn timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn search_terms(question: &str) -> Vec<String> {
    question
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .map(str::trim)
        .filter(|term| term.len() > 2)
        .map(str::to_lowercase)
        .filter(|term| {
            !matches!(
                term.as_str(),
                "the" | "and" | "for" | "with" | "from" | "this" | "that" | "what" | "how" | "why"
            )
        })
        .collect()
}

fn retrieval_score(question: &str, text: &str) -> f32 {
    let query_terms = search_terms(question);
    let text_terms = search_terms(text);

    if query_terms.is_empty() || text_terms.is_empty() {
        return 0.0;
    }

    let mut score = 0.0;
    for term in &query_terms {
        let matches = text_terms
            .iter()
            .filter(|candidate| *candidate == term)
            .count();
        if matches > 0 {
            score += 1.0 + (matches as f32).ln();
        }
    }

    score / ((query_terms.len() as f32).sqrt() * (text_terms.len() as f32).sqrt())
}

fn excerpt(text: &str, max_chars: usize) -> String {
    let mut output = text.chars().take(max_chars).collect::<String>();
    if text.chars().count() > max_chars {
        output.push_str("...");
    }
    output
}

fn first_sentence(text: &str) -> String {
    text.split(['.', '!', '?', '\n'])
        .find(|segment| segment.trim().len() > 24)
        .unwrap_or(text)
        .trim()
        .to_string()
}

fn normalize_text(text: &str) -> String {
    text.replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn chunk_text(
    document_id: &str,
    text: &str,
    target_chars: usize,
    overlap_chars: usize,
) -> Vec<DocumentChunk> {
    let char_positions: Vec<(usize, char)> = text.char_indices().collect();

    if char_positions.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut start_char = 0usize;

    while start_char < char_positions.len() {
        let target_end_char = (start_char + target_chars).min(char_positions.len());
        let end_char = find_chunk_boundary(&char_positions, start_char, target_end_char);
        let start_offset = char_positions[start_char].0;
        let end_offset = if end_char >= char_positions.len() {
            text.len()
        } else {
            char_positions[end_char].0
        };

        let chunk_text = text[start_offset..end_offset].trim().to_string();

        if !chunk_text.is_empty() {
            let chunk_index = chunks.len();
            chunks.push(DocumentChunk {
                id: format!("{document_id}-chunk-{chunk_index}"),
                chunk_index,
                token_estimate: estimate_tokens(&chunk_text),
                text: chunk_text,
                start_offset,
                end_offset,
            });
        }

        if end_char >= char_positions.len() {
            break;
        }

        start_char = end_char.saturating_sub(overlap_chars);
        if start_char == end_char {
            start_char += 1;
        }
    }

    chunks
}

fn find_chunk_boundary(
    char_positions: &[(usize, char)],
    start_char: usize,
    target_end_char: usize,
) -> usize {
    let min_end = (start_char + 400).min(target_end_char);

    for index in (min_end..target_end_char).rev() {
        let ch = char_positions[index].1;
        if matches!(ch, '.' | '!' | '?' | '\n') {
            return index + 1;
        }
    }

    target_end_char
}

fn estimate_tokens(text: &str) -> usize {
    text.split_whitespace().count().max(1)
}

fn create_id(prefix: &str, seed: &str) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let slug = seed
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(24)
        .collect::<String>()
        .to_lowercase();

    if slug.is_empty() {
        format!("{prefix}-{timestamp}")
    } else {
        format!("{prefix}-{slug}-{timestamp}")
    }
}
