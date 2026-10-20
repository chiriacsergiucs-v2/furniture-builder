# Data safety / security

Client-side, no accounts or server-side storage. Dexie persists by origin/device; device storage clearing or origin change can erase it. Versioned JSON backups essential. Legacy migration must be atomic and non-destructive. Generic CSV export should prevent spreadsheet formula injection (reported in prior research, not retested in this session). Git safety: do not commit private furniture cutlists/workbooks or reset user data. Physical installation safety is out of software certification.
