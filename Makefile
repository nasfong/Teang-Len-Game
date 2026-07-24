# Teang Len — production image builds.
#
#   make build   build both images (web + api) locally
#   make push    build AND push both images to the registry
#   make print   show the resolved image tags
#
# Override any variable on the CLI, e.g.:
#   make push REGISTRY=ghcr.io/acme TAG=v1.2.3 VITE_API_URL=https://api.teanglen.com
#
# Cross-building an amd64 image on an Apple-Silicon Mac uses buildx (bundled with
# Docker Desktop). Run `docker login <registry>` before `make push`.

# ── Config (override on the CLI or via the environment) ──────────────────────
REGISTRY     ?= docker.io/nasfong
WEB_IMAGE    ?= $(REGISTRY)/teang-len-web
API_IMAGE    ?= $(REGISTRY)/teang-len-api
TAG          ?= production
PLATFORM     ?= linux/amd64

# Baked into the web bundle at BUILD time (Vite inlines it). MUST point at the
# deployed API origin — the web build fails if this is left unset/empty.
VITE_API_URL ?= https://teang-len-api.nasfong.com

# Testing builds only: `true` auto-registers a throw-away account on first visit
# so the site opens straight on Home. Keep `false` for production images, e.g.
#   make push-web TAG=testing VITE_API_URL=https://api-test.example.com VITE_AUTO_GUEST=true
VITE_AUTO_GUEST ?= true

BUILDX = docker buildx build --platform $(PLATFORM)

.PHONY: build build-web build-api push push-web push-api print

# ── Build (load into the local Docker image store) ───────────────────────────
build: build-api build-web ## Build both images locally

build-api:
	$(BUILDX) --load \
	  -t $(API_IMAGE):$(TAG) -t $(API_IMAGE):latest \
	  -f backend/Dockerfile backend

build-web:
	$(BUILDX) --load \
	  --build-arg VITE_API_URL=$(VITE_API_URL) \
	  --build-arg VITE_AUTO_GUEST=$(VITE_AUTO_GUEST) \
	  -t $(WEB_IMAGE):$(TAG) -t $(WEB_IMAGE):latest \
	  -f Dockerfile .

# ── Push (build + push straight to the registry) ─────────────────────────────
push: push-api push-web ## Build and push both images

push-api:
	$(BUILDX) --push \
	  -t $(API_IMAGE):$(TAG) -t $(API_IMAGE):latest \
	  -f backend/Dockerfile backend

push-web:
	$(BUILDX) --push \
	  --build-arg VITE_API_URL=$(VITE_API_URL) \
	  --build-arg VITE_AUTO_GUEST=$(VITE_AUTO_GUEST) \
	  -t $(WEB_IMAGE):$(TAG) -t $(WEB_IMAGE):latest \
	  -f Dockerfile .

print: ## Show the resolved image tags
	@echo "web: $(WEB_IMAGE):$(TAG)  (VITE_API_URL=$(VITE_API_URL), VITE_AUTO_GUEST=$(VITE_AUTO_GUEST))"
	@echo "api: $(API_IMAGE):$(TAG)"
	@echo "platform: $(PLATFORM)"
