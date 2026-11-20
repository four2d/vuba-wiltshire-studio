# Vuba media library: folders and video

Delivered to development branch 2026-11-20.

## User experience
The Media Library has its own dedicated screen. Staff can drop JPEG/PNG/WebP images or MP4/MOV/WebM video files onto the library, choose individual files, or import whole directories using a browser folder picker. Nested folder paths are preserved as metadata in `studio_media.folder_path`; the original private Storage object paths are unchanged. Paths can be browsed with breadcrumbs, or new virtual folders created.

A small batch upload runs 12 files at a time and can be resumed with **Import next batch** for larger folders. Files must be <= 45MB, and all require an explicit usage-rights note. Oversized video files require a separate resumable-upload integration, not yet provided.

Staff can search descriptions, names and tags and filter by photo/video and review state. Admins and approvers can approve files, move files between folders, add tags, edit descriptions/rights notes and archive assets. Archive retains the original object but removes it from the active library. Renaming folders and batch-moving selections are not yet built.

## Security and boundaries
Storage bucket `vuba-approved-media` is private with team-only RLS; the 45MB bucket limit accepts supported media MIME types. New uploads always have `approved=false`. Media attachment to static posts remains **image-only** for now, to avoid trying to render video files as image tags. A video post/reel player and publishing pipeline must be implemented separately. Private asset previews use one-hour signed URLs; Open generates a five-minute signed link.

The legacy individual-upload form remains in DOM for backwards compatibility but is hidden within the new dedicated Media Library page.

## Tests
JS syntax checks, database migration and member folder-insert transaction rollback. Real browser large-folder upload and video playback still need end-to-end QA.
