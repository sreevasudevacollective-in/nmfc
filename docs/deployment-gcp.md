# Deploying NMFC to Google Cloud

Platform decision and rationale: **[ADR 0005](decisions/0005-gcp-platform.md)**.

> **None of this has been executed.** It is written from the service contracts, not
> validated against a live project. Expect to correct details on the first run, and check
> flag names against `gcloud --help` if a command is rejected — the CLI moves.

Everything except the web app and transactional email lives in one GCP project in
`asia-south1` (Mumbai). Co-locating the API and database there is the point: a page render
issues several sequential queries, and splitting them across regions makes each one pay a
cross-region round trip.

## What runs where

| Component | Service |
|---|---|
| API | Cloud Run (`nmfc-api`) |
| Migrations | Cloud Run Job (`nmfc-migrate`) |
| Database | Cloud SQL for PostgreSQL (`nmfc-db`) |
| Images | Cloud Storage |
| Auth | Firebase Auth |
| Secrets | Secret Manager |
| Images (container) | Artifact Registry |
| Web | **Vercel** — unchanged, see ADR 0005 |
| Email | **External provider — still undecided** |

---

## 1. Project and APIs

```bash
export PROJECT_ID=nmfc-prod
export REGION=asia-south1

gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Billing must be linked before the APIs below will enable.
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com
```

## 2. Artifact Registry

```bash
gcloud artifacts repositories create nmfc \
  --repository-format=docker \
  --location="$REGION" \
  --description="NMFC container images"
```

## 3. Cloud SQL

`db-f1-micro` is the cheapest tier and carries **no SLA** — fine pre-launch, revisit before
it matters (ADR 0005).

```bash
gcloud sql instances create nmfc-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=19:00

gcloud sql databases create nmfc --instance=nmfc-db
gcloud sql users create nmfc --instance=nmfc-db --password='<generate-a-strong-one>'
```

**Enable Managed Connection Pooling on the instance.** This is not optional once more than
one Cloud Run instance is running — Prisma opens a pool per container, and a fight-night
scale-out exhausts Postgres connections long before CPU. It is also the single most common
way a Prisma app falls over under load, and retrofitting it during an outage is miserable.

## 4. Secrets

```bash
INSTANCE="$PROJECT_ID:$REGION:nmfc-db"

printf 'postgresql://nmfc:%s@localhost/nmfc?host=/cloudsql/%s' '<password>' "$INSTANCE" \
  | gcloud secrets create nmfc-database-url --data-file=-
```

Note the connection string shape: Cloud Run reaches Cloud SQL over a **Unix socket**, so the
path goes in `?host=` and the `@localhost` authority is ignored.

## 5. Service account

Least privilege — the API needs to reach Cloud SQL, read its own secret, and use Cloud
Storage. Nothing else.

```bash
gcloud iam service-accounts create nmfc-api --display-name="NMFC API"
SA="nmfc-api@$PROJECT_ID.iam.gserviceaccount.com"

for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/storage.objectAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" --role="$role"
done
```

## 6. Cloud Storage

Fighter portraits and event posters. The schema stores storage **keys**, not URLs
(`Fighter.photoKey`, `Event.posterKey`), so the bucket or CDN domain can change later
without a data migration.

```bash
gcloud storage buckets create "gs://$PROJECT_ID-media" \
  --location="$REGION" \
  --uniform-bucket-level-access
```

Uploads go through **V4 signed URLs**: the admin asks the API for one, uploads directly to
the bucket, and sends back the resulting key. No storage credentials ever reach a client and
the API never proxies image bytes.

Putting Cloud CDN in front of this requires a load balancer (~$18–25/month). Not worth it at
current scale — serve from the bucket, or let Vercel optimize images.

## 7. Migration job

Migrations run here, once, as a deploy step — **never at app boot**, where several
instances starting together would race each other.

```bash
gcloud run jobs create nmfc-migrate \
  --region="$REGION" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/nmfc/api:latest" \
  --service-account="$SA" \
  --set-cloudsql-instances="$INSTANCE" \
  --set-secrets=DATABASE_URL=nmfc-database-url:latest \
  --command=npx \
  --args=prisma,migrate,deploy \
  --max-retries=0 \
  --task-timeout=10m
```

## 8. API service

`--min-instances=1` keeps one container warm. Scaling to zero would add a cold start to the
first request after idle, which is the wrong trade for a public site — and it is the ~$10–12
of the monthly bill that buys responsiveness.

`PORT` is injected by Cloud Run; the app reads it. Do not set it.

```bash
gcloud run deploy nmfc-api \
  --region="$REGION" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/nmfc/api:latest" \
  --service-account="$SA" \
  --set-cloudsql-instances="$INSTANCE" \
  --set-secrets=DATABASE_URL=nmfc-database-url:latest \
  --set-env-vars=NODE_ENV=production,CORS_ORIGINS=https://nmfc.example.com \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --timeout=30s \
  --allow-unauthenticated
```

`--allow-unauthenticated` is correct here: this is a public read API. Authorization happens
inside the app by verifying the Firebase JWT, not at the Cloud Run boundary.

**`CORS_ORIGINS` is required.** The API refuses to boot in production without it — a
deliberate guard, so a misconfigured deploy fails loudly instead of silently serving any
origin.

## 9. Firebase Auth

Same GCP project, despite the separate console.

1. Add Firebase to the project at <https://console.firebase.google.com>
2. Authentication → enable **Email/Password** and **Google**
3. Configure **custom SMTP** with the chosen email provider

**Do not skip the SMTP step before launch.** Default provider email is rate-limited and has
no delivery SLA. Applicants and fighters receive verification, claim links and decisions by
email; those cannot bounce. GCP has no native transactional email service, so this needs an
external provider (Resend, SendGrid, Mailgun) — still undecided (ADR 0005, Open).

Admin role claims are set as Firebase **custom claims** via the Admin SDK, which the API
reads from the verified token. There is no separate admin table (ADR 0002).

## 10. Continuous deployment

`apps/api/cloudbuild.yaml` builds, migrates, then deploys — in that order, so a failed
migration stops the build before the new revision takes traffic.

```bash
gcloud builds submit --config=apps/api/cloudbuild.yaml .
```

To run it on every push to `main`, create a Cloud Build trigger against the repository
pointing at the same config. Cloud Build's service account needs `roles/run.developer`,
`roles/iam.serviceAccountUser` and `roles/artifactregistry.writer`.

## 11. Web app

Vercel, unchanged. Point it at the Cloud Run URL:

```
NEXT_PUBLIC_API_URL=https://nmfc-api-<hash>-<region>.a.run.app
```

Then add that origin to `CORS_ORIGINS` on the Cloud Run service.

**Vercel Hobby prohibits commercial use** — a ticketed promotion needs Pro. ADR 0001's
$25–30/month estimate assumed Hobby and was wrong for that reason.

---

## Rough monthly cost

| Item | Cost |
|---|---|
| Cloud Run, 1 warm instance | $10–12 |
| Cloud SQL `db-f1-micro` + 10GB | $10–12 |
| Cloud Storage + egress | ~$2 |
| Secret Manager, Artifact Registry | <$1 |
| **GCP subtotal** | **~$25–30** |
| Vercel Pro | $20 |
| Email provider | $0–15 |

Verify against the pricing calculator before committing — India-region rates differ from the
US figures most published comparisons quote.

## Not done here

- **Terraform.** All of the above is imperative `gcloud`. Fine at this size; if the setup
  starts drifting or needs a second environment, port it.
- **Staging.** One environment, as ADR 0001 decided. Add one when a bad deploy would hurt.
- **Cloud Armor / WAF.** Not needed for a public read API at this scale.
