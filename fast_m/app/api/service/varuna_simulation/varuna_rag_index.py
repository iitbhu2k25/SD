# """
# varuna_rag_index.py — FAISS + sentence-transformers RAG index for the
# Varuna Simulation chatbot (ported from the Streamlit app's chatbot.py).

# Indexes: the engine's own source files, every saved scenario (from the JSON
# scenario store), and any user-uploaded PDF/CSV/HTML documents.
# """
# from __future__ import annotations

# import csv
# import io
# import logging
# import os
# import pickle
# from pathlib import Path
# from typing import Any

# import numpy as np
# from bs4 import BeautifulSoup
# from sqlalchemy.orm import Session

# from app.conf.settings import Settings
# from app.api.service.varuna_simulation import varuna_scenario_store as store

# logger = logging.getLogger(__name__)

# _MODULE_DIR = Path(__file__).parent
# _TEMP_DIR = Path(Settings().TEMP_DIR) / "varuna_sim"
# _UPLOADS_DIR = _TEMP_DIR / "rag_uploads"
# _INDEX_FILE = _TEMP_DIR / "rag_index.pkl"

# _TEMP_DIR.mkdir(parents=True, exist_ok=True)
# _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# FILES_TO_INDEX = ["varuna_engine.py", "component.py", "varuna_simulation_service.py"]

# _embedder = None


# def _load_embedder():
#     global _embedder
#     if _embedder is None:
#         from sentence_transformers import SentenceTransformer
#         _embedder = SentenceTransformer("all-MiniLM-L6-v2")
#     return _embedder


# def _chunk_text(text: str, filename: str, page: int | None = None, row_range: str | None = None,
#                 chunk_size: int = 200, overlap: int = 40) -> list[dict]:
#     words = text.split()
#     chunks = []
#     for i in range(0, len(words), chunk_size - overlap):
#         chunk_words = words[i:i + chunk_size]
#         chunk = " ".join(chunk_words)
#         if chunk.strip():
#             chunk_data: dict[str, Any] = {"text": chunk, "source": filename}
#             if page is not None:
#                 chunk_data["page"] = page
#             if row_range is not None:
#                 chunk_data["row_range"] = row_range
#             chunks.append(chunk_data)
#     return chunks


# def parse_and_chunk_bytes(filename: str, content: bytes) -> list[dict]:
#     ext = os.path.splitext(filename)[1].lower()

#     if ext == ".pdf":
#         import PyPDF2
#         chunks = []
#         reader = PyPDF2.PdfReader(io.BytesIO(content))
#         for page_num, page in enumerate(reader.pages):
#             page_text = page.extract_text()
#             if page_text and page_text.strip():
#                 chunks.extend(_chunk_text(page_text, filename, page=page_num + 1))
#         return chunks

#     if ext == ".csv":
#         text = content.decode("utf-8", errors="ignore")
#         reader = csv.DictReader(io.StringIO(text))
#         row_texts = []
#         for idx, row in enumerate(reader):
#             row_num = idx + 1
#             row_summary = f"Row {row_num}: " + ", ".join(f"{col} is {val}" for col, val in row.items() if val)
#             row_texts.append((row_num, row_summary))

#         chunks = []
#         i = 0
#         while i < len(row_texts):
#             chunk_rows, word_count, j = [], 0, i
#             while j < len(row_texts) and word_count < 200:
#                 chunk_rows.append(row_texts[j])
#                 word_count += len(row_texts[j][1].split())
#                 j += 1
#             if not chunk_rows:
#                 break
#             chunk_text_str = " ".join(r[1] for r in chunk_rows)
#             chunks.append({
#                 "text": chunk_text_str,
#                 "source": filename,
#                 "row_range": f"{chunk_rows[0][0]}-{chunk_rows[-1][0]}",
#             })
#             overlap_words = overlap_rows = 0
#             for r in reversed(chunk_rows):
#                 row_words = len(r[1].split())
#                 if overlap_words + row_words <= 40:
#                     overlap_words += row_words
#                     overlap_rows += 1
#                 else:
#                     break
#             i += max(1, len(chunk_rows) - overlap_rows)
#         return chunks

#     if ext in (".html", ".htm"):
#         soup = BeautifulSoup(content.decode("utf-8", errors="ignore"), "html.parser")
#         for script in soup(["script", "style"]):
#             script.decompose()
#         text = " ".join(soup.get_text(separator=" ").split())
#         return _chunk_text(text, filename) if text.strip() else []

#     raise ValueError(f"Unsupported file format: {ext}")


# def _load_scenario_chunks(db: Session) -> list[dict]:
#     chunks = []
#     for s in store.list_scenarios(db):
#         rows = s.rows or []
#         last = rows[-1] if rows else {}
#         text = f"""Scenario Report: {s.name}
# Generated: {s.created_at.isoformat() if s.created_at else ''}
# Strategies applied: {', '.join(s.strategies or []) or 'Baseline (no intervention)'}
# Treatment percentage: {s.treatment_pct:.1f}%
# Total sewage generated: {last.get('Total Sewage (MLD)', 0):.1f} MLD
# Treated sewage: {last.get('Treated (MLD)', 0):.1f} MLD
# Untreated load reaching river: {s.untreated:.1f} MLD
# BOD of river: {last.get('BOD of River', 0):.2f} mg/L
# Drain overflow: {last.get('Tapped Drain Overflow Total (MLD)', 0):.1f} MLD
# STP overflow: {last.get('STP Overflow (MLD)', 0):.1f} MLD
# Capital cost: {last.get('Capital Cost (Cr)', 0):.2f} Crores
# O&M cost: {last.get('OM Cost (Cr)', 0):.2f} Crores"""
#         chunks.append({"text": text, "source": f"report:{s.name}", "scenario_id": s.id})
#     return chunks


# def _report_count(db: Session) -> int:
#     return store.count_scenarios(db)


# def _embed_normalized(embedder, texts: list[str]) -> np.ndarray:
#     embeddings = embedder.encode(texts, show_progress_bar=False)
#     norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
#     norms[norms == 0] = 1.0
#     return embeddings / norms


# def rebuild_index(db: Session):
#     import faiss

#     embedder = _load_embedder()
#     all_chunks: list[dict] = []

#     for fname in FILES_TO_INDEX:
#         fpath = _MODULE_DIR / fname
#         if fpath.exists():
#             try:
#                 all_chunks.extend(_chunk_text(fpath.read_text(encoding="utf-8", errors="ignore"), fname))
#             except Exception as e:
#                 logger.warning("Could not read %s: %s", fname, e)

#     all_chunks.extend(_load_scenario_chunks(db))

#     if _UPLOADS_DIR.exists():
#         for fpath in _UPLOADS_DIR.iterdir():
#             if fpath.is_file():
#                 try:
#                     all_chunks.extend(parse_and_chunk_bytes(fpath.name, fpath.read_bytes()))
#                 except Exception as e:
#                     logger.warning("Could not parse uploaded file %s: %s", fpath.name, e)

#     if not all_chunks:
#         if _INDEX_FILE.exists():
#             _INDEX_FILE.unlink()
#         return None, [], embedder

#     texts = [c["text"] for c in all_chunks]
#     embeddings = _embed_normalized(embedder, texts)

#     dim = embeddings.shape[1]
#     index = faiss.IndexFlatIP(dim)
#     index.add(np.array(embeddings, dtype="float32"))

#     with open(_INDEX_FILE, "wb") as f:
#         pickle.dump({
#             "embeddings": embeddings,
#             "chunks": all_chunks,
#             "dim": dim,
#             "report_count": _report_count(db),
#         }, f)

#     return index, all_chunks, embedder


# def load_or_build_index(db: Session):
#     import faiss

#     embedder = _load_embedder()
#     report_count = _report_count(db)

#     if _INDEX_FILE.exists():
#         try:
#             with open(_INDEX_FILE, "rb") as f:
#                 saved = pickle.load(f)
#             if saved.get("report_count", 0) == report_count:
#                 index = faiss.IndexFlatIP(saved["dim"])
#                 index.add(np.array(saved["embeddings"], dtype="float32"))
#                 return index, saved["chunks"], embedder
#         except Exception:
#             pass

#     return rebuild_index(db)


# def add_file_to_index(db: Session, filename: str, content: bytes) -> int:
#     import faiss

#     fpath = _UPLOADS_DIR / filename
#     fpath.write_bytes(content)

#     chunks = parse_and_chunk_bytes(filename, content)
#     if not chunks:
#         raise ValueError("Could not extract any clean text chunks from the uploaded file.")

#     embedder = _load_embedder()
#     new_embeddings = _embed_normalized(embedder, [c["text"] for c in chunks])

#     if _INDEX_FILE.exists():
#         with open(_INDEX_FILE, "rb") as f:
#             saved = pickle.load(f)
#         updated_embeddings = np.vstack([saved["embeddings"], new_embeddings])
#         updated_chunks = saved["chunks"] + chunks
#     else:
#         updated_embeddings = new_embeddings
#         updated_chunks = chunks

#     dim = updated_embeddings.shape[1]
#     index = faiss.IndexFlatIP(dim)
#     index.add(np.array(updated_embeddings, dtype="float32"))

#     with open(_INDEX_FILE, "wb") as f:
#         pickle.dump({
#             "embeddings": updated_embeddings,
#             "chunks": updated_chunks,
#             "dim": dim,
#             "report_count": _report_count(db),
#         }, f)

#     return len(chunks)


# def retrieve(query: str, index, chunks: list[dict], embedder, top_k: int = 3,
#              included_sources: dict[str, bool] | None = None) -> list[dict]:
#     if index is None or not chunks:
#         return []

#     query_vec = embedder.encode([query])
#     q_norms = np.linalg.norm(query_vec, axis=1, keepdims=True)
#     q_norms[q_norms == 0] = 1.0
#     query_vec = query_vec / q_norms

#     similarities, indices = index.search(np.array(query_vec, dtype="float32"), min(50, len(chunks)))

#     results, seen = [], set()
#     for i, idx in enumerate(indices[0]):
#         if idx >= len(chunks):
#             continue
#         chunk = chunks[idx]
#         source = chunk["source"]
#         if source.startswith("report:"):
#             source_key = source
#         elif source in FILES_TO_INDEX:
#             source_key = f"code:{source}"
#         else:
#             source_key = f"upload:{source}"

#         if included_sources is not None and not included_sources.get(source_key, True):
#             continue

#         key = chunk["text"][:100]
#         if key not in seen:
#             seen.add(key)
#             results.append({"chunk": chunk, "similarity": float(similarities[0][i])})
#             if len(results) >= top_k:
#                 break

#     return results
