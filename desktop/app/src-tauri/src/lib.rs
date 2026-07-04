use postgres::{Client, NoTls};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

const POSTGRES_SCHEMA: &str = include_str!(
    "../../../../shared-core/infrastructure/database/migrations/001_initial_postgres.sql"
);

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
            get_document_chunks,
            ask_document_question,
            generate_study_items,
            get_runtime_config,
            save_runtime_config,
            build_vector_index,
            speak_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize)]
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

#[derive(serde::Serialize)]
struct DocumentChunk {
    id: String,
    chunk_index: usize,
    text: String,
    start_offset: usize,
    end_offset: usize,
    token_estimate: usize,
}

#[derive(serde::Serialize)]
struct StoredDocument {
    id: String,
    title: String,
    file_type: String,
    file_size: i64,
    chunk_count: i64,
    created_at: String,
}

#[derive(serde::Serialize)]
struct StoredChunk {
    id: String,
    chunk_index: i32,
    text: String,
    start_offset: i32,
    end_offset: i32,
    token_estimate: i32,
}

#[derive(serde::Serialize)]
struct TutorAnswer {
    answer: String,
    citations: Vec<AnswerCitation>,
}

#[derive(serde::Serialize)]
struct AnswerCitation {
    chunk_id: String,
    chunk_index: i32,
    excerpt: String,
}

#[derive(serde::Serialize)]
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
    if persisted {
        if let Some(mut client) = connect_database()? {
            ensure_schema(&mut client)?;
            let _ = persist_embeddings(&mut client, &document_id, &chunks);
        }
    }

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
    let Some(mut client) = connect_database()? else {
        return Ok(Vec::new());
    };

    ensure_schema(&mut client)?;

    let rows = client
        .query(
            "SELECT d.id, d.title, d.file_type, d.file_size, d.created_at::text, COUNT(c.id)::bigint AS chunk_count
             FROM documents d
             LEFT JOIN chunks c ON c.document_id = d.id
             GROUP BY d.id
             ORDER BY d.created_at DESC
             LIMIT 50",
            &[],
        )
        .map_err(|error| format!("Failed to list documents: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| StoredDocument {
            id: row.get(0),
            title: row.get(1),
            file_type: row.get(2),
            file_size: row.get(3),
            created_at: row.get(4),
            chunk_count: row.get(5),
        })
        .collect())
}

#[tauri::command]
fn get_document_chunks(document_id: String) -> Result<Vec<StoredChunk>, String> {
    let Some(mut client) = connect_database()? else {
        return Ok(Vec::new());
    };

    ensure_schema(&mut client)?;
    load_chunks(&mut client, &document_id)
}

#[tauri::command]
fn ask_document_question(document_id: String, question: String) -> Result<TutorAnswer, String> {
    let Some(mut client) = connect_database()? else {
        return Err(
            "PostgreSQL is not connected. Set DATABASE_URL and run the Tauri app.".to_string(),
        );
    };

    ensure_schema(&mut client)?;
    let chunks = load_chunks(&mut client, &document_id)?;
    let terms = search_terms(&question);

    if terms.is_empty() {
        return Err("Ask a more specific question so I can search the document.".to_string());
    }

    let query_vector = embed_text(&question);
    let embeddings = load_embedding_vectors(&mut client, &document_id).unwrap_or_default();
    let mut scored = chunks
        .into_iter()
        .map(|chunk| {
            let vector_score = embeddings
                .iter()
                .find(|embedding| embedding.chunk_id == chunk.id)
                .map(|embedding| cosine_similarity(&query_vector, &embedding.vector))
                .unwrap_or(0.0);
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

    let citations = scored
        .into_iter()
        .take(3)
        .map(|(_, chunk)| AnswerCitation {
            excerpt: excerpt(&chunk.text, 360),
            chunk_id: chunk.id,
            chunk_index: chunk.chunk_index,
        })
        .collect::<Vec<_>>();

    if citations.is_empty() {
        return Ok(TutorAnswer {
            answer: "I could not find matching support in the selected document chunks. Try rephrasing or import more material.".to_string(),
            citations,
        });
    }

    let answer = synthesize_answer(&question, &citations).unwrap_or_else(|| {
        let joined = citations
            .iter()
            .map(|citation| citation.excerpt.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");
        format!(
            "I found {} relevant source chunk{}. Based on the retrieved evidence: {}",
            citations.len(),
            if citations.len() == 1 { "" } else { "s" },
            excerpt(&joined, 700)
        )
    });

    Ok(TutorAnswer { answer, citations })
}

#[tauri::command]
fn generate_study_items(document_id: String) -> Result<Vec<StudyItem>, String> {
    let Some(mut client) = connect_database()? else {
        return Ok(Vec::new());
    };

    ensure_schema(&mut client)?;
    let chunks = load_chunks(&mut client, &document_id)?;

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
    let mut config = RuntimeConfig {
        llama_binary_path: std::env::var("LLAMA_CPP_BIN").unwrap_or_default(),
        llm_model_path: std::env::var("LLM_MODEL_PATH").unwrap_or_default(),
        piper_binary_path: std::env::var("PIPER_BIN").unwrap_or_default(),
        piper_voice_path: std::env::var("PIPER_VOICE_PATH").unwrap_or_default(),
        faiss_index_dir: std::env::var("FAISS_INDEX_DIR")
            .unwrap_or_else(|_| default_index_dir().to_string_lossy().to_string()),
    };

    if let Some(mut client) = connect_database()? {
        ensure_schema(&mut client)?;
        for row in client
            .query("SELECT id, path FROM models", &[])
            .map_err(|error| format!("Failed to load runtime config: {error}"))?
        {
            let id: String = row.get(0);
            let path: String = row.get(1);
            match id.as_str() {
                "runtime-llama-bin" => config.llama_binary_path = path,
                "runtime-llm-model" => config.llm_model_path = path,
                "runtime-piper-bin" => config.piper_binary_path = path,
                "runtime-piper-voice" => config.piper_voice_path = path,
                "runtime-faiss-dir" => config.faiss_index_dir = path,
                _ => {}
            }
        }
    }

    Ok(config)
}

#[tauri::command]
fn save_runtime_config(config: RuntimeConfig) -> Result<RuntimeConfig, String> {
    if let Some(mut client) = connect_database()? {
        ensure_schema(&mut client)?;
        upsert_model_path(
            &mut client,
            "runtime-llama-bin",
            "llama.cpp binary",
            "runtime_binary",
            &config.llama_binary_path,
        )?;
        upsert_model_path(
            &mut client,
            "runtime-llm-model",
            "Local GGUF LLM",
            "llm",
            &config.llm_model_path,
        )?;
        upsert_model_path(
            &mut client,
            "runtime-piper-bin",
            "Piper binary",
            "runtime_binary",
            &config.piper_binary_path,
        )?;
        upsert_model_path(
            &mut client,
            "runtime-piper-voice",
            "Piper voice model",
            "tts",
            &config.piper_voice_path,
        )?;
        upsert_model_path(
            &mut client,
            "runtime-faiss-dir",
            "FAISS index directory",
            "vector_index",
            &config.faiss_index_dir,
        )?;
    }

    Ok(config)
}

#[tauri::command]
fn build_vector_index(document_id: String) -> Result<IndexResult, String> {
    let Some(mut client) = connect_database()? else {
        return Err(
            "PostgreSQL is not connected. Set DATABASE_URL and run the Tauri app.".to_string(),
        );
    };

    ensure_schema(&mut client)?;
    let chunks = load_chunks(&mut client, &document_id)?
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

    let result = persist_embeddings(&mut client, &document_id, &chunks)?;
    Ok(result)
}

#[tauri::command]
fn speak_text(text: String) -> Result<SpeechResult, String> {
    let config = get_runtime_config()?;
    if config.piper_binary_path.trim().is_empty() || config.piper_voice_path.trim().is_empty() {
        return Err(
            "Set Piper binary and voice model paths in Models before using TTS.".to_string(),
        );
    }

    let binary = Path::new(&config.piper_binary_path);
    let voice = Path::new(&config.piper_voice_path);
    if !binary.exists() {
        return Err("Piper binary path does not exist.".to_string());
    }
    if !voice.exists() {
        return Err("Piper voice model path does not exist.".to_string());
    }

    let output_dir = default_audio_dir();
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Failed to create TTS output directory: {error}"))?;
    let audio_path = output_dir.join(format!("echolearn-{}.wav", timestamp_millis()));

    let mut child = Command::new(binary)
        .arg("--model")
        .arg(voice)
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
    })
}

fn load_chunks(client: &mut Client, document_id: &str) -> Result<Vec<StoredChunk>, String> {
    let rows = client
        .query(
            "SELECT id, chunk_index, text, start_offset, end_offset, token_estimate
             FROM chunks
             WHERE document_id = $1
             ORDER BY chunk_index ASC",
            &[&document_id],
        )
        .map_err(|error| format!("Failed to load chunks: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| StoredChunk {
            id: row.get(0),
            chunk_index: row.get(1),
            text: row.get(2),
            start_offset: row.get(3),
            end_offset: row.get(4),
            token_estimate: row.get(5),
        })
        .collect())
}

struct ChunkEmbedding {
    chunk_id: String,
    vector: Vec<f32>,
}

fn load_embedding_vectors(
    client: &mut Client,
    document_id: &str,
) -> Result<Vec<ChunkEmbedding>, String> {
    let rows = client
        .query(
            "SELECT e.chunk_id, e.vector_json
             FROM embeddings e
             INNER JOIN chunks c ON c.id = e.chunk_id
             WHERE c.document_id = $1 AND e.model_id = 'echolearn-hash-384'",
            &[&document_id],
        )
        .map_err(|error| format!("Failed to load embeddings: {error}"))?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let chunk_id: String = row.get(0);
            let vector_json: Option<String> = row.get(1);
            let vector =
                vector_json.and_then(|json| serde_json::from_str::<Vec<f32>>(&json).ok())?;
            Some(ChunkEmbedding { chunk_id, vector })
        })
        .collect())
}

fn persist_embeddings(
    client: &mut Client,
    document_id: &str,
    chunks: &[DocumentChunk],
) -> Result<IndexResult, String> {
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

    client
        .execute(
            "DELETE FROM embeddings WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = $1)",
            &[&document_id],
        )
        .map_err(|error| format!("Failed to refresh embeddings: {error}"))?;

    for chunk in chunks {
        let vector = embed_text(&chunk.text);
        let vector_json = serde_json::to_string(&vector)
            .map_err(|error| format!("Failed to encode embedding: {error}"))?;
        let embedding_id = format!("emb-{}", chunk.id);
        let vector_id = (stable_hash(&chunk.id) & 0x7fff_ffff_ffff_ffff) as i64;
        let index_path_text = index_path.to_string_lossy().to_string();

        client
            .execute(
                "INSERT INTO embeddings (id, chunk_id, model_id, vector_id, dimension, index_path, vector_json)
                 VALUES ($1, $2, 'echolearn-hash-384', $3, $4, $5, $6)",
                &[
                    &embedding_id,
                    &chunk.id,
                    &vector_id,
                    &(vector.len() as i32),
                    &index_path_text,
                    &vector_json,
                ],
            )
            .map_err(|error| format!("Failed to save embedding for chunk {}: {error}", chunk.chunk_index))?;

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
    let Some(mut client) = connect_database()? else {
        return Ok(false);
    };

    ensure_schema(&mut client)?;

    let mut transaction = client
        .transaction()
        .map_err(|error| format!("Failed to start database transaction: {error}"))?;

    transaction
        .execute(
            "INSERT INTO documents (id, title, file_path, file_type, file_size, import_status)
             VALUES ($1, $2, $3, $4, $5, 'imported')
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               file_type = EXCLUDED.file_type,
               file_size = EXCLUDED.file_size,
               updated_at = CURRENT_TIMESTAMP",
            &[&document_id, &name, &name, &file_type, &(file_size as i64)],
        )
        .map_err(|error| format!("Failed to save document: {error}"))?;

    transaction
        .execute("DELETE FROM chunks WHERE document_id = $1", &[&document_id])
        .map_err(|error| format!("Failed to replace document chunks: {error}"))?;

    for chunk in chunks {
        transaction
            .execute(
                "INSERT INTO chunks (id, document_id, chunk_index, text, start_offset, end_offset, token_estimate)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
                &[
                    &chunk.id,
                    &document_id,
                    &(chunk.chunk_index as i32),
                    &chunk.text,
                    &(chunk.start_offset as i32),
                    &(chunk.end_offset as i32),
                    &(chunk.token_estimate as i32),
                ],
            )
            .map_err(|error| format!("Failed to save chunk {}: {error}", chunk.chunk_index))?;
    }

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit import: {error}"))?;

    Ok(true)
}

fn connect_database() -> Result<Option<Client>, String> {
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(None),
    };

    Client::connect(&database_url, NoTls)
        .map(Some)
        .map_err(|error| format!("Failed to connect to PostgreSQL: {error}"))
}

fn ensure_schema(client: &mut Client) -> Result<(), String> {
    client
        .batch_execute(POSTGRES_SCHEMA)
        .map_err(|error| format!("Failed to apply PostgreSQL schema: {error}"))
}

fn upsert_model_path(
    client: &mut Client,
    id: &str,
    name: &str,
    kind: &str,
    path: &str,
) -> Result<(), String> {
    client
        .execute(
            "INSERT INTO models (id, name, kind, path, status)
             VALUES ($1, $2, $3, $4, 'configured')
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               kind = EXCLUDED.kind,
               path = EXCLUDED.path,
               status = EXCLUDED.status,
               updated_at = CURRENT_TIMESTAMP",
            &[&id, &name, &kind, &path],
        )
        .map(|_| ())
        .map_err(|error| format!("Failed to save model path {id}: {error}"))
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

fn synthesize_answer(question: &str, citations: &[AnswerCitation]) -> Option<String> {
    let config = get_runtime_config().ok()?;
    if config.llama_binary_path.trim().is_empty() || config.llm_model_path.trim().is_empty() {
        return None;
    }

    let binary = Path::new(&config.llama_binary_path);
    let model = Path::new(&config.llm_model_path);
    if !binary.exists() || !model.exists() {
        return None;
    }

    let evidence = citations
        .iter()
        .map(|citation| format!("[chunk {}] {}", citation.chunk_index + 1, citation.excerpt))
        .collect::<Vec<_>>()
        .join("\n");
    let prompt = format!(
        "You are EchoLearn AI. Answer only from the evidence. If the evidence is insufficient, say so.\n\nQuestion: {question}\n\nEvidence:\n{evidence}\n\nAnswer:"
    );

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

fn default_index_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data")
        .join("faiss")
}

fn default_audio_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data")
        .join("tts")
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
