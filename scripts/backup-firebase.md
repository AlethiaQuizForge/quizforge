# Firebase Backup Strategy

## Option 1: Manual Export (Free)

1. Go to Firebase Console → Firestore → Import/Export
2. Click "Export" → Choose a Cloud Storage bucket
3. Download the exported files

## Option 2: Automatic Daily Backups (Recommended)

### Using Firebase Scheduled Backups
1. Go to Firebase Console → Firestore → Backups (under Data)
2. Enable "Point-in-time recovery" (Blaze plan required)
3. Set retention period

### Using Google Cloud Scheduler + Cloud Functions
If on Blaze plan, create a Cloud Function that runs daily:

```javascript
// functions/backup.js
const admin = require('firebase-admin');
const firestore = admin.firestore();

exports.scheduledBackup = async () => {
  const bucket = 'gs://your-backup-bucket';
  const timestamp = new Date().toISOString().split('T')[0];

  await firestore.exportDocuments(
    bucket + '/backups/' + timestamp
  );
};
```

## Option 3: Local Export Script

Run this locally to export data:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Export Firestore data
firebase firestore:export gs://quizforge-58f79.appspot.com/backups/$(date +%Y-%m-%d)
```

## What to Back Up

Priority data:
- `quizforge-account-*` - User accounts
- `quizforge-*` - User quiz data
- `classes` - Class information
- `shared-*` - Shared quizzes

## Recovery

To restore from backup:
```bash
firebase firestore:import gs://quizforge-58f79.appspot.com/backups/YYYY-MM-DD
```

## Recommended Schedule

- Daily: Automated export to Cloud Storage
- Weekly: Download a local copy
- Monthly: Verify backups can be restored
