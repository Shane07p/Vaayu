.PHONY: up down logs test fmt clean

up:
	docker compose up --build -d
	@echo "backend  http://localhost:8080/actuator/health"
	@echo "web      http://localhost:3000"
	@echo "swagger  http://localhost:8080/swagger-ui.html"

down:
	docker compose down -v

logs:
	docker compose logs -f

test:
	cd backend && ./mvnw test
	cd ingestion && uv run pytest
	cd ml && uv run pytest
	cd web && pnpm lint

fmt:
	cd ingestion && uv run ruff format . && uv run ruff check --fix .
	cd ml && uv run ruff format . && uv run ruff check --fix .
	cd web && pnpm lint --fix

clean:
	docker compose down -v --remove-orphans
