# Stitch Visual Ground Truth & Iconography Governance (INV-STITCH-05 & INV-UI-EMOJI-BAN)

### 1. Invarianten
- **INV-STITCH-05 (Visual SSOT Ground Truth Invariant):**
  Zodra een Google Stitch scherm of screenshot is aangewezen als SSOT, moeten componenten worden getoetst aan de werkelijke visuele hiërarchie, gestapelde micro-labels, contrastnormen (WCAG 2.1 AA >= 4.5:1) en tokenkleuren uit globals.css. Toetsing mag nooit uitsluitend plaatsvinden tegen tekstuele beschrijvingen.
- **INV-UI-EMOJI-BAN (Raw Unicode Emoji Ban):**
  Ruwe OS Unicode emoji's (zoals 📅, 📝, 📐, 🔨, 🔒, 📎, 📍, 🔍, 📄, 📋) zijn categorisch verboden in UI componenten (`src/components/`). Alle iconografie moet worden gerealiseerd via zuivere vector SVGs of `lucide-react`.

### 2. Handhaving
Gehandhaafd via Pijler 3 in `scripts/design_token_guard.py` met ratchet baseline.
