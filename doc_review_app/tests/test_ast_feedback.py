import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from doc_review_app.config import settings

def test_ast_annotation_crud_and_feedback(client: TestClient, auth_headers_reviewer1: dict, auth_headers_reviewer2: dict, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "documents_dir", tmp_path)
    # 1. Create a markdown document
    doc_content = (
        "# Handleiding Raambekleding\n\n"
        "## Categorie 1: Gordijnen\n\n"
        "### Plooitypes & Confectie\n\n"
        "* Klassieke plooien:\n"
        "    * Enkele plooi: minimale stofinname (ca. 1.8x - 2.0x de railbreedte).\n"
        "    * Dubbele plooi (vlinderplooi): rijkere valling.\n\n"
        "Einde van document."
    )
    sync_resp = client.post("/api/documents/sync", headers=auth_headers_reviewer1, json={
        "filename": "gordijnen_handleiding.md",
        "content": doc_content,
        "format": "markdown"
    })
    assert sync_resp.status_code in (200, 201)
    doc_id = sync_resp.json()["id"]
    filename = "gordijnen_handleiding.md"

    # 2. Create annotation with AST path and node type
    ast_path = "Categorie 1: Gordijnen > Plooitypes & Confectie > Klassieke plooien > Enkele plooi"
    node_type = "ListItem"
    anno_payload = {
        "start_offset": 80,
        "end_offset": 93,
        "selected_text": "Enkele plooi",
        "comment_content": "Controleer of de stofinname van 1.8x klopt bij kamerhoge stoffen.",
        "badge_color": "#FF6D00",
        "ast_path": ast_path,
        "node_type": node_type
    }

    create_resp = client.post(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1, json=anno_payload)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["ast_path"] == ast_path
    assert created["node_type"] == node_type
    annotation_id = created["id"]

    # 3. Add a reply from reviewer 2
    reply_payload = {
        "content": "Bij kamerhoge stoffen adviseren we standaard minimaal 2.0x voor een strakke plooival."
    }
    reply_resp = client.post(
        f"/api/annotations/{annotation_id}/comments",
        headers=auth_headers_reviewer2,
        json=reply_payload
    )
    assert reply_resp.status_code == 201

    # 4. Fetch annotations list and verify AST metadata
    list_resp = client.get(f"/api/documents/{doc_id}/annotations", headers=auth_headers_reviewer1)
    assert list_resp.status_code == 200
    annos = list_resp.json()
    matched = [a for a in annos if a["id"] == annotation_id]
    assert len(matched) == 1
    assert matched[0]["ast_path"] == ast_path
    assert matched[0]["node_type"] == node_type

    # 5. Fetch AST Feedback markdown via GET endpoint
    feedback_resp = client.get(f"/api/documents/{doc_id}/feedback", headers=auth_headers_reviewer1)
    assert feedback_resp.status_code == 200
    fb_data = feedback_resp.json()
    assert fb_data["document_id"] == doc_id
    assert fb_data["filename"] == filename
    assert "markdown" in fb_data
    md = fb_data["markdown"]

    # Check structural markers in generated AI prompt
    assert f"# AST Review Feedback voor `{filename}`" in md
    assert ast_path in md
    assert node_type in md
    assert "Controleer of de stofinname van 1.8x klopt" in md
    assert "Bij kamerhoge stoffen adviseren we standaard minimaal 2.0x" in md

    # 6. Trigger AST Feedback export to file via POST endpoint
    export_resp = client.post(f"/api/documents/{doc_id}/export-feedback", headers=auth_headers_reviewer1)
    assert export_resp.status_code == 200
    export_data = export_resp.json()
    assert export_data["status"] == "success"
    assert "export_path" in export_data
    exported_file = Path(export_data["export_path"])
    assert exported_file.exists()
    disk_content = exported_file.read_text(encoding="utf-8")
    assert disk_content == export_data["markdown"]

def test_ast_feedback_unauthenticated(client: TestClient):
    # Unauthenticated requests must fail with 401
    resp_get = client.get("/api/documents/dummy-doc-id/feedback")
    assert resp_get.status_code == 401

    resp_post = client.post("/api/documents/dummy-doc-id/export-feedback")
    assert resp_post.status_code == 401
