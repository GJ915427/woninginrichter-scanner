"""Storage package for Document Review JSON sidecars, cloud sync, and migration."""

from doc_review_app.storage.cloud_sync import pull_sidecars_from_cloud, push_sidecar_to_cloud
from doc_review_app.storage.json_storage import (
    get_sidecar_path,
    read_sidecar,
    save_annotation_to_sidecar,
    save_comment_delete_to_sidecar,
    save_comment_edit_to_sidecar,
    save_comment_reply_to_sidecar,
    write_sidecar_atomic,
)
from doc_review_app.storage.migration import (
    auto_migrate_if_needed,
    hydrate_sidecars_to_sqlite,
    migrate_sqlite_annotations_to_sidecars,
)

__all__ = [
    "get_sidecar_path",
    "read_sidecar",
    "write_sidecar_atomic",
    "save_annotation_to_sidecar",
    "save_comment_reply_to_sidecar",
    "save_comment_edit_to_sidecar",
    "save_comment_delete_to_sidecar",
    "push_sidecar_to_cloud",
    "pull_sidecars_from_cloud",
    "migrate_sqlite_annotations_to_sidecars",
    "auto_migrate_if_needed",
    "hydrate_sidecars_to_sqlite",
]
