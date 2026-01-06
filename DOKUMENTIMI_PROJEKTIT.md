# UDHËZIME PËR DOKUMENTIMIN DHE DORËZIMIN E PROJEKTIT SPDD

## Pika 8: Dokumentimi dhe Dorëzimi i Projektit

Bazuar në kërkesat teknike të prof. Dr.sc. Liridon Hoti, kjo është një udhëzues i detajuar për dokumentimin dhe dorëzimin e projektit tuaj.

---

## 📄 FORMATI I RAPORTIT TEKNIK

### Kërkesat Bazë:
- **Format:** `.docx` (Microsoft Word)
- **Gjuhë:** Shqip ose Anglisht (profesionale, pa gabime)
- **Strukturë:** Me faqe titulli, tabelë përmbajtjeje, numerim faqesh

---

## 📋 STRUKTURA E RAPORTIT (Kapitujt Minimale)

### 1. **Përmbledhje Ekzekutive (Abstract)**
- Përshkrim i shkurtër i projektit (150-200 fjalë)
- Problemi që zgjidh projekti
- Teknologjitë kryesore të përdorura
- Rezultatet kryesore

**Shembull për projektin tuaj:**
> "Ky projekt implementon një sistem menaxhimi të eventeve bazuar në arkitekturë mikrosherbimesh, duke përdorur FastAPI, React, Kafka, PostgreSQL, MongoDB, dhe Kubernetes. Sistemi ofron krijim dhe menaxhim të eventeve, regjistrim të pjesëmarrësve, dhe analizë në kohë reale përmes event-driven architecture."

---

### 2. **Qëllimi dhe Objektivat e Projektit**

**Qëllimi:**
- Të krijohet një sistem i shkallëzueshëm për menaxhimin e eventeve
- Të implementohen parimet e mikrosherbimeve dhe event-driven architecture
- Të demonstrohen teknologjitë moderne të procesimit të të dhënave

**Objektivat:**
- ✅ Implementimi i mikrosherbimeve të pavarura (event-service, analytics-service)
- ✅ Integrimi i Kafka për event streaming
- ✅ Përdorimi i PostgreSQL dhe MongoDB (hybrid storage)
- ✅ Deployment në Kubernetes me auto-scaling
- ✅ Monitoring dhe observability me Prometheus, Grafana, Jaeger
- ✅ Frontend modern me React
- ✅ CI/CD pipeline (nëse keni)

---

### 3. **Analiza e Kërkesave Funksionale dhe Jofunksionale**

#### **Kërkesat Funksionale:**
- **FR1:** Përdoruesi mund të krijojë evente të reja (titull, përshkrim, vendndodhje, datë, numër vende)
- **FR2:** Përdoruesi mund të shikojë listën e të gjitha eventeve
- **FR3:** Përdoruesi mund të regjistrojë pjesëmarrës për një event
- **FR4:** Përdoruesi mund të shikojë listën e pjesëmarrësve për një event
- **FR5:** Sistemi ruan të dhënat e eventeve në PostgreSQL
- **FR6:** Sistemi ruan të dhënat e analizave në MongoDB
- **FR7:** Sistemi publikon ngjarje në Kafka kur krijohet event i ri

#### **Kërkesat Jofunksionale:**
- **NFR1: Performanca:** Përgjigje < 200ms për 95% të kërkesave
- **NFR2: Shkallëzueshmëri:** Auto-scaling në Kubernetes bazuar në CPU/RAM
- **NFR3: Resiliencë:** Circuit breaker, retry, fallback mechanisms
- **NFR4: Observability:** Monitoring me Prometheus, tracing me Jaeger
- **NFR5: Siguri:** CORS, validation, error handling
- **NFR6: Disponueshmëri:** Health checks, graceful shutdown

---

### 4. **Projektimi i Sistemit**

#### **4.1 Arkitektura e Sistemit**

**Diagrami i Arkitekturës:**
```
┌─────────────┐
│   React UI  │ (Frontend - Port 3000)
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────────────────────────────┐
│         API Gateway / Load Balancer      │
└─────────────────────────────────────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│Event Service│  │Analytics    │  │  (Future    │
│  (FastAPI)  │  │  Service    │  │  Services)  │
│  Port 8000  │  │  (Consumer) │  │             │
└──────┬──────┘  └──────┬──────┘  └─────────────┘
       │                │
       │                │ Kafka Events
       │                │
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │   Kafka     │
│  (Events)   │  │  (Streaming)│
└─────────────┘  └──────┬───────┘
                        │
                        ▼
                 ┌─────────────┐
                 │  MongoDB     │
                 │  (Analytics) │
                 └─────────────┘
```

**Komponentët:**
- **Frontend:** React SPA me Vite
- **Event Service:** FastAPI mikrosherbim për CRUD operacione
- **Analytics Service:** Kafka consumer që proceson ngjarje
- **Message Broker:** Apache Kafka me Schema Registry
- **Databases:** PostgreSQL (relacional) + MongoDB (NoSQL)
- **Monitoring:** Prometheus + Grafana + Jaeger

#### **4.2 Event-Driven Architecture**

**Kafka Topics:**
- `event.created` - Publikohet kur krijohet event i ri
- (Mund të shtoni: `event.updated`, `event.deleted`, `participant.registered`)

**Flow:**
1. User krijon event → Event Service → PostgreSQL
2. Event Service publikon në Kafka topic `event.created`
3. Analytics Service konsumon nga Kafka
4. Analytics Service ruan në MongoDB për analizë

#### **4.3 Modelimi i të Dhënave**

**PostgreSQL Schema (Events):**
```sql
events:
  - id (PK)
  - title
  - description
  - location
  - date
  - seats

participants:
  - id (PK)
  - event_id (FK → events.id)
  - name
  - email
  - phone
```

**MongoDB Collections (Analytics):**
```json
{
  "event_id": 1,
  "title": "Event Title",
  "ts": "2024-01-01T10:00:00",
  "created_at": "2024-01-01T09:00:00"
}
```

**Diagrami ERD:**
- Vizatoni diagramin ERD për PostgreSQL (events, participants)
- Tregoni relacionet (One-to-Many: Event → Participants)

#### **4.4 Mikrosherbimet**

**Event Service:**
- Teknologji: FastAPI (Python)
- Database: PostgreSQL
- Responsibilities: CRUD për events dhe participants, Kafka producer
- Port: 8000
- Health endpoint: `/health`

**Analytics Service:**
- Teknologji: Python (Kafka consumer)
- Database: MongoDB
- Responsibilities: Konsumon ngjarje nga Kafka, ruan në MongoDB
- Nuk ka HTTP port (vetëm consumer)

#### **4.5 Deployment Architecture**

**Docker Compose (Development):**
- Të gjitha shërbimet në containers
- Networking me Docker networks
- Volumes për data persistence

**Kubernetes (Production):**
- Deployments për çdo mikrosherbim
- HPA (Horizontal Pod Autoscaler) për auto-scaling
- Service Discovery me Consul (nëse keni)
- Istio Service Mesh (nëse keni konfiguruar)

---

### 5. **Përshkrimi i Implementimit**

#### **5.1 Teknologjitë e Përdorura**

**Backend:**
- Python 3.x
- FastAPI (web framework)
- SQLAlchemy (ORM)
- psycopg2 (PostgreSQL driver)
- kafka-python (Kafka client)
- pymongo (MongoDB driver)
- prometheus-client (metrics)

**Frontend:**
- React 18
- Vite (build tool)
- Axios (HTTP client)

**Infrastructure:**
- Docker & Docker Compose
- Kubernetes (K8s)
- Apache Kafka + Schema Registry
- PostgreSQL 15
- MongoDB 6.0
- Prometheus (monitoring)
- Grafana (visualization)
- Jaeger (tracing)

#### **5.2 Komponentët Kryesore**

**Event Service (`event-service/app/main.py`):**
- REST API endpoints:
  - `GET /events` - Lista e eventeve
  - `POST /events` - Krijo event
  - `GET /events/{id}` - Detajet e eventit
  - `DELETE /events/{id}` - Fshi event
  - `GET /events/{id}/participants` - Lista e pjesëmarrësve
  - `POST /events/{id}/participants` - Regjistro pjesëmarrës
  - `DELETE /events/{id}/participants/{pid}` - Hiq pjesëmarrës

**Resilience Patterns (`event-service/app/resilience.py`):**
- Circuit Breaker (pybreaker)
- Retry mechanism (tenacity)
- Bulkhead pattern
- Prometheus metrics

**Kafka Producer (`event-service/app/kafka_producer.py`):**
- Publikon ngjarje në topic `event.created`
- Error handling dhe retry logic

**Analytics Consumer (`analytics-service/app/consumer.py`):**
- Konsumon nga Kafka topic `event.created`
- Ruan në MongoDB për analizë

**Frontend (`ui/src/`):**
- React components për UI
- API integration me Axios
- Error handling dhe loading states

#### **5.3 Konfigurimet**

**Docker Compose (`infra/docker-compose.yml`):**
- Konfigurimi i të gjitha shërbimeve
- Networking dhe volumes
- Environment variables

**Kubernetes (`k8s/`):**
- Deployments
- Services
- HPA (Horizontal Pod Autoscaler)
- Istio configurations (nëse keni)

**Prometheus (`monitoring/prometheus/prometheus.yml`):**
- Scrape configs për shërbimet
- Alert rules (nëse keni)

---

### 6. **Testimi dhe Rezultatet**

#### **6.1 Llojet e Testeve**

**Unit Tests:**
- Testimi i funksioneve individuale
- Testimi i models dhe validations

**Integration Tests:**
- Testimi i komunikimit midis shërbimeve
- Testimi i Kafka producer/consumer
- Testimi i database operations

**End-to-End Tests:**
- Testimi i flow të plotë: Frontend → Backend → Database → Kafka → Analytics

#### **6.2 Rezultatet e Testeve**

**Performance Metrics:**
- Response time për API calls
- Throughput (requests/second)
- Latency percentiles (p50, p95, p99)

**Monitoring Metrics:**
- CPU dhe RAM usage
- Request rates
- Error rates
- Circuit breaker states

**Screenshots:**
- Grafana dashboards me metrika
- Jaeger traces
- Frontend UI screenshots

---

### 7. **Përfundime dhe Rekomandime**

#### **7.1 Përfundime**
- Çfarë u arrit me projektin
- Sfidat që u përballuan
- Mësimet e nxjerra

#### **7.2 Rekomandime për Përmirësime**
- Shtimi i autentifikimit dhe autorizimit (OAuth2/JWT)
- Shtimi i caching me Redis
- Shtimi i CI/CD pipeline
- Shtimi i më shumë testave
- Optimizimi i performancës

---

### 8. **Referencat dhe Burimet e Përdorura**

**Dokumentacione Zyrtare:**
- FastAPI Documentation: https://fastapi.tiangolo.com/
- React Documentation: https://react.dev/
- Kafka Documentation: https://kafka.apache.org/documentation/
- Kubernetes Documentation: https://kubernetes.io/docs/

**Librari dhe Paketa:**
- Lista e të gjitha paketave nga `requirements.txt`
- Versione të përdorura

**Burime të Tjera:**
- Tutorials, artikuj, video që keni përdorur

---

### 9. **Shtojcat**

**Shtojca A: Fragmente Kodi**
- Shembuj të kodit kryesor
- Konfigurime të rëndësishme

**Shtojca B: Skema dhe Diagrame**
- ERD diagrams
- Sequence diagrams
- Architecture diagrams

**Shtojca C: Screenshots**
- UI screenshots
- Grafana dashboards
- Jaeger traces
- Kubernetes dashboard

**Shtojca D: Test Results**
- Output nga testet
- Performance metrics

---

### 10. **Deklaratë Origjinaliteti**

Në fund të raportit, duhet të përfshini një deklaratë:

```
DEKLARATË ORIGJINALITETI

Unë [Emri Mbiemri], student në [Fakulteti/Departamenti], konfirmoj se:

1. Kjo punë është rezultat i punës sime origjinale.
2. Të gjitha burimet e përdorura janë cituar në seksionin e referencave.
3. Nuk ka plagjiaturë në këtë punim.
4. Të gjitha kontributet e të tjerëve janë të identifikuara dhe të cituara.

Data: ___________
Nënshkrim: ___________
```

---

## 📦 PREPARIMI I KODIT PËR DORËZIM

### Struktura e Dosjes:

```
EmriMbiemri_Projekti_SPDD/
├── event-service/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── analytics-service/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── ui/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── infra/
│   └── docker-compose.yml
├── k8s/
│   └── ...
├── monitoring/
│   └── ...
├── scripts/
│   └── ...
├── README.md
└── .gitignore
```

### Çfarë të Përfshini:
- ✅ Të gjithë kodin burimor
- ✅ Dockerfiles
- ✅ Docker Compose files
- ✅ Kubernetes manifests
- ✅ Konfigurimet (Prometheus, etc.)
- ✅ Scripts për deployment
- ✅ README me udhëzime

### Çfarë të MOS Përfshini:
- ❌ `node_modules/` (frontend)
- ❌ `__pycache__/` (Python)
- ❌ `.venv/` ose `venv/` (virtual environments)
- ❌ `.git/` (git history - ose përfshini nëse kërkohet)
- ❌ Log files
- ❌ Temporary files

### Kompresimi:
- Format: `.zip` ose `.rar`
- Emri: `EmriMbiemri_Projekti_SPDD.zip`
- Ose për grup: `GrupiX_Projekti_SPDD.rar`

---

## 📤 DORËZIMI NË MOODLE

### Materialet që duhen ngarkuar:
1. **Raporti Teknik** (`.docx`)
2. **Kodi i Projektit** (`.zip` ose `.rar`)

### Hapat:
1. Hyni në Moodle
2. Shkoni te seksioni i lëndës SPDD
3. Gjeni seksionin "Dorëzimi i Projektit"
4. Ngarkoni të dy skedarët
5. Verifikoni që të dy skedarët janë ngarkuar
6. Dorëzoni para afatit!

### ⚠️ Kujdes:
- **Afati i dorëzimit:** Kontrolloni datën në Moodle
- **Pas afatit:** Sistemi nuk pranon më ngarkesa
- **Dorëzimet me vonesë:** Nuk vlerësohen

---

## ✅ CHECKLIST PARA DORËZIMIT

### Raporti (.docx):
- [ ] Ka faqe titulli
- [ ] Ka tabelë përmbajtjeje
- [ ] Ka numerim faqesh
- [ ] Ka të gjitha 9 kapitujt minimale
- [ ] Ka shtojca (nëse ka)
- [ ] Ka deklaratë origjinaliteti
- [ ] Nuk ka gabime drejtshkrimore
- [ ] Gjuhë profesionale

### Kodi (.zip/.rar):
- [ ] Emri është në formatin e duhur
- [ ] Përmban të gjithë kodin
- [ ] Nuk përmban `node_modules/`, `__pycache__/`, `.venv/`
- [ ] Ka README me udhëzime
- [ ] Kompresohet me sukses

### Dorëzimi:
- [ ] Të dy skedarët janë gati
- [ ] Kontrolluar para afatit
- [ ] Ngarkuar në Moodle
- [ ] Verifikuar që u ngarkuan

---

## 📊 KRAHASIMI ME KËRKESAT TEKNIKE

### Çfarë ka projekti juaj që përmbush kërkesat:

✅ **Arkitektura e Sistemit:**
- ✅ Mikrosherbime (event-service, analytics-service)
- ✅ Event-driven Architecture (Kafka)
- ✅ Docker Compose për development
- ✅ Kubernetes për production
- ✅ Service Discovery (Consul - nëse keni)

✅ **Të Dhënat:**
- ✅ Hybrid Storage (PostgreSQL + MongoDB)
- ✅ Event Streaming (Kafka)
- ✅ Schema Registry (Confluent Schema Registry)

✅ **Siguria:**
- ✅ CORS configuration
- ✅ Input validation
- ✅ Error handling

✅ **Performanca:**
- ✅ Circuit Breaker
- ✅ Retry mechanisms
- ✅ Health checks

✅ **Monitorimi:**
- ✅ Prometheus (metrics)
- ✅ Grafana (visualization)
- ✅ Jaeger (distributed tracing)

✅ **Standardet:**
- ✅ API documentation (FastAPI auto-generates OpenAPI)
- ✅ Version control (Git)

### Çfarë mund të shtoni për të përmbushur plotësisht:

🔲 **CI/CD Pipeline:**
- GitHub Actions ose GitLab CI/CD
- Automated testing
- Automated deployment

🔲 **Caching:**
- Redis për cache
- Write-through caching

🔲 **Load Balancing:**
- NGINX ose Envoy
- Layer 7 load balancing

🔲 **Autentifikim:**
- OAuth2/JWT
- Secrets management (Vault)

---

## 💡 KËSHILLA FINALE

1. **Filloni dokumentimin herët** - mos e lini për ditën e fundit
2. **Bëni screenshots** - Grafana, Jaeger, UI, Kubernetes
3. **Testoni projektin** - sigurohuni që funksionon para dorëzimit
4. **Kontrolloni afatin** - në Moodle
5. **Backup** - ruani kopje të projektit
6. **Lexoni raportin** - para dorëzimit, kontrolloni gabimet

---

**Suksese me projektin! 🚀**

