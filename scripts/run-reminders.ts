/** Runs the daily reminder job once. Schedule daily, e.g. cron: 0 8 * * * cd /app && npm run reminders */
import "./load-env";
import { runReminders } from "../src/server/services/reminders";

runReminders()
  .then((r) => {
    console.log("Reminders run:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
