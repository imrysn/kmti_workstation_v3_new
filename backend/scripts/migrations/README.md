# KMTI Database Migrations Registry

This directory contains legacy database migration, schema alteration, and backfilling scripts. These scripts are run against the primary MySQL instance (`kmtiworkstation`).

## Schema Modification Scripts

1. **`add_display_name_column.py`**
   - Adds the user/display name metadata fields to tables.
2. **`add_display_name_to_status.py`**
   - Updates status tracking tables to support user display names.
3. **`add_equipped_skin_column.py`**
   - Adds columns for customization/skin preferences for workstation interfaces.
4. **`add_ip_column.py`**
   - Adds IP tracking column to workstations for client identification.
5. **`fix_db_enum.py` & `fix_db_index.py`**
   - Repairs database enum mappings and sets correct database indexes for query optimization.

## Data Migration & Backfill Scripts

1. **`backfill_db.py`**
   - Populates initial records and standardizes default structures.
2. **`migrate_billing.py` & `migrate_billing_status.py`**
   - Performs structure upgrades for billing, invoice tracking, and payment monitor statuses.
3. **`migrate_chars.py`**
   - Migrates characters, font configurations, or language layouts.
4. **`migrate_indexes.py`**
   - Upgrades or rebuilds database search indexes.
5. **`migrate_roles.py`**
   - Sets up initial permissions and role categories for authenticated users.
6. **`migrate_to_unc.py` & `revert_unc_migration.py`**
   - Handles the migration of local/drive file paths to Uniform Naming Convention (UNC) paths (e.g. `\\KMTI-NAS\...`), and fallback controls.
7. **`migrate_tree.py`**
   - Upgrades file folder hierarchy index tables.
8. **`migrate_workstation.py`**
   - Transfers workstation parameters from v2 schema formats.

---

> [!NOTE]
> All new database modifications should be added as structured, version-controlled scripts here with a clear suffix (e.g. `V4__...`) before migrating to a formal migrations system like Alembic.
