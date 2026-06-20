# Preserving the existing database and data structures

This is the requirement to "keep all the data structures and databases the same." The
migration changes the *access layer* (so Django/DRF and agent tools can reach the data)
without changing the *stored schema or rows* unless a move is explicitly chosen and
verified.

Pick exactly one strategy in Stage 1 and record why. The default is **Strategy A**.

---

## Strategy A — Bind to the existing database (no data move)

Best when the legacy database stays where it is and you only need the platform to read
and write it. Nothing about the stored data changes.

1. Add the legacy database to the platform's `DATABASES` (either as `default` if this
   app owns the DB, or as a named connection with a database router if it coexists with
   the platform's own Postgres).
2. Define Django models that map **exactly** to the existing tables, and set
   `managed = False` so Django never issues DDL against them:

   ```python
   # utils/apps/{name}/backend/models/invoice.py
   from django.db import models

   class Invoice(models.Model):
       # column names and types must match the legacy table exactly
       id = models.BigAutoField(primary_key=True, db_column="id")
       number = models.CharField(max_length=32, db_column="invoice_number")
       customer_id = models.BigIntegerField(db_column="customer_id")
       total = models.DecimalField(max_digits=12, decimal_places=2, db_column="total")
       created_at = models.DateTimeField(db_column="created_at")

       class Meta:
           managed = False              # Django will NOT create/alter/drop this table
           db_table = "invoices"        # the existing legacy table name
   ```

3. Match every detail: column names (`db_column`), types, `max_length`, nullability
   (`null=`/`blank=`), defaults, unique constraints, and indexes. Mismatches cause
   silent read/write bugs against real data.
4. Reproduce foreign keys with `db_column` pointing at the existing FK column; keep
   `on_delete` consistent with the legacy behavior (often `DO_NOTHING` when `managed =
   False`).

**Verify before committing:** a read-only script lists rows through the new models and
the counts and spot-checked field values match the legacy source. No migration is
generated for these tables.

**Later (optional):** if you decide Django should own a table's schema going forward,
flip `managed = True` and create an initial migration with `--fake` so Django adopts
the current state without recreating it.

---

## Strategy B — Inspect and adopt

Best when you don't have clean model definitions for the legacy schema (e.g. a Flask
app with hand-rolled SQL, or you want Django's view of the live schema).

1. Point `DATABASES['default']` (or a named connection) at the legacy database.
2. Generate models from the live schema:

   ```bash
   uv run manage.py inspectdb > /tmp/{name}_inspected.py
   ```

3. Curate the output into `utils/apps/{name}/backend/models/`: rename classes to your
   conventions while **keeping** `db_table` and `db_column` so the binding holds, fix
   relationships `inspectdb` couldn't infer, and decide `managed = True/False` per table.
4. Treat `inspectdb` output as a starting point, not gospel — verify types, especially
   for JSON, array, enum, and money columns.

**Verify before committing:** same round-trip read check as Strategy A.

---

## Strategy C — Migrate the data into the platform database

Choose this only when you are deliberately consolidating the app into the platform's
PostgreSQL/pgvector instance (e.g. to use shared search/embeddings/events). The schema
is recreated by Django and the rows are moved with verification.

1. Define normal managed Django models in `backend/models/` matching the legacy schema's
   meaning (you may modernize column names here since data is being copied, not bound).
2. Generate and apply migrations against the platform DB:

   ```bash
   uv run manage.py makemigrations {name}
   uv run manage.py migrate
   ```

3. Move the data with a verified ETL: read from the legacy source, transform to the new
   shape, bulk-insert into the platform DB. Prefer a Django data migration or a one-off
   management command so it is repeatable and reviewable.
4. **Verify the move** before deleting anything: row counts per table match, primary
   keys are preserved (or a documented remap exists), and a checksum/hash of key columns
   matches between source and destination. Keep the legacy DB until verification passes.

**Verify before committing:** counts and checksums match; a sample of records is
byte-for-byte equivalent in meaning. Document any intentional transformations.

---

## Choosing

| Situation | Strategy |
| --- | --- |
| Legacy DB stays put; just need access | A — bind to existing |
| No clean models; want Django's view of the live schema | B — inspect and adopt |
| Consolidating into platform Postgres/pgvector | C — migrate with verification |

When unsure, start with **A**: it is the lowest-risk way to satisfy "keep the data the
same," and you can move to B or C later as a separate, verified milestone.

## Rules that apply to all strategies

- Never let Django auto-create or alter a table that already holds data unless you have
  chosen Strategy C and verified the move.
- Preserve types exactly for money (`Decimal`), timestamps/timezones, JSON, arrays, and
  enums — these are the usual sources of silent corruption.
- Keep the verification script in the test suite (`tests/utils/apps/{name}/`) so the
  data binding is re-checked on every run.
- Back up the legacy database before any write path is enabled against it.
