## Document management — Vuba Brain

Added 20 November 2026.

Drag PDF, DOCX, TXT or MD files onto the Brain page, or browse files. Maximum 15 MB/file; 10 documents per selection. Documents are uploaded directly from the signed-in browser to the **private** Supabase Storage bucket `vuba-brain-documents`, under a UUID-namespaced folder; originals remain unchanged on the user's computer.

A separate `studio_brain_documents` table stores the title, filename, source notes, extraction status, searchable text, owner and review status. Extracted text is private to the workspace. The browser uses PDF.js 4.10.38 for machine-readable PDFs and JSZip 3.10.1 for DOCX, plus built-in text reading for TXT/MD. No paid AI API is used. For large PDFs, the first 60 pages or up to 120,000 text characters are indexed. Scanned/image-only PDFs are retained but cannot be indexed without OCR or manually entered text.

Admins/approvers can edit document titles, descriptions, extracted text and verification, and archive or restore documents. Archive hides them from the active library but retains the original file. Existing Brain knowledge entries can also be edited and archived/restored. A trigger sends approved knowledge back to `needs_review` if its substantive text or source fields change; document approval resets if document title, description or searchable text changes.

**Publication control:** Uploading a document does not certify its factual claims, does not automatically populate approved Brain snippets, and does not grant an external AI permission to read it. The documents are available as searchable, cited reference material for the Vuba team. Staff must explicitly review claims and promote relevant facts into approved Brain entries before those facts inform social copy.

Only authenticated workspace members can read; anonymous users have no table SELECT rights. A stored-file signed URL is created only when a member clicks Open file and lasts five minutes. No permanent public links or API credentials in browser source.

This release has database and JS parse tests, but signed-in browser drag/drop, Word/PDF extraction and cross-device behaviour still require hands-on QA.
