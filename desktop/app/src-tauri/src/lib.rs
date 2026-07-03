use postgres::{Client, NoTls};

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
            ask_document_question
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

    let mut scored = chunks
        .into_iter()
        .map(|chunk| {
            let lower = chunk.text.to_lowercase();
            let score = terms
                .iter()
                .filter(|term| lower.contains(term.as_str()))
                .count();
            (score, chunk)
        })
        .filter(|(score, _)| *score > 0)
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| right.0.cmp(&left.0));

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

    let answer = format!(
        "I found {} relevant source chunk{}. Full local LLM synthesis is still pending, so this answer is grounded as retrieved evidence for now.",
        citations.len(),
        if citations.len() == 1 { "" } else { "s" }
    );

    Ok(TutorAnswer { answer, citations })
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

fn excerpt(text: &str, max_chars: usize) -> String {
    let mut output = text.chars().take(max_chars).collect::<String>();
    if text.chars().count() > max_chars {
        output.push_str("...");
    }
    output
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
