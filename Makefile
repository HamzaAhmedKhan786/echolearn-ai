APP_NAME=echolearn-ai

.PHONY: help init docs test check desktop-dev desktop-build clean

help:
	@echo "EchoLearn AI commands:"
	@echo "  make init      Create project folders"
	@echo "  make docs      Create documentation files"
	@echo "  make test      Run tests placeholder"
	@echo "  make check     Run desktop validation"
	@echo "  make rust-check Run Tauri/Rust validation"
	@echo "  make desktop-dev   Start the desktop web UI"
	@echo "  make desktop-build Build the desktop web UI"
	@echo "  make clean     Remove temporary files"

init:
	mkdir -p docs architecture shared-core desktop mobile models assets scripts ci-cd databases tools
	mkdir -p shared-core/{domain,application,infrastructure,ai,document_processing,speech,security,model_manager,tests}
	mkdir -p desktop/{app,tauri,ai-runtime,packaging,tests}
	mkdir -p mobile/{flutter_app,android,ios}
	mkdir -p .github/workflows

docs:
	touch docs/PRD.md docs/ROADMAP.md docs/ARCHITECTURE.md docs/SECURITY.md docs/MODEL_MANAGEMENT.md docs/OFFLINE_STRATEGY.md

test:
	@echo "Tests will be added after core implementation."

check:
	cd desktop/app && npm run check

rust-check:
	cd desktop/app/src-tauri && cargo check

desktop-dev:
	cd desktop/app && npm run dev

desktop-build:
	cd desktop/app && npm run build

clean:
	rm -rf .pytest_cache coverage htmlcov
	find . -type d -name "__pycache__" -exec rm -rf {} +
