# Milk Bill Management

A phone app for people who sell milk to regular customers. It records each customer's daily milk,
makes monthly bills as pictures, and keeps track of advances and payments. It works fully offline,
and dates use the Nepali calendar (Bikram Sambat, e.g. 2083/06/19), matching Hamro Patro.
Screens are in English or Nepali; bills are printed in English.

Developed by **Pawan Paudyal**.

## Features

- **Daily milk**: pick the day and tap **Give usual milk** to fill everyone's usual amount. Then fix only the
  customers who took more, less or none, using − and + or the ½, 1, 1½ … picker.
- **Customers**: name, address and phone are optional. Each has a price per litre (changeable) and a usual
  amount. Customers can be put in delivery order and marked as stopped.
- **Monthly bills** run from day 1 to the end of the month, one bill per customer. Bills are saved as
  pictures or shared on WhatsApp. **Save all bills** saves the whole month at once.
- **Advances and payments**, unpaid balances, and **Mark as paid**.
- **Reports**: month totals per customer, saved as an image or an Excel (CSV) file.
- **Your shop's name, address and phone** (Settings) head the app and are printed on every bill.
- **Phone-friendly**: the screens keep a fixed size (no zoom, font-size setting ignored), the status bar stays
  visible, and it runs on Android 7.0 or newer.

## Install on an Android phone

1. Download the newest `.apk` file from this repository's **Releases** page.
2. Open the file on the phone. If Android asks, allow **Install unknown apps** for the app you opened it with.
3. Tap **Install**. If Google Play Protect shows a warning, tap **More details**, then **Install anyway**.
   This is normal for apps that don't come from the Play Store.
4. Open the app, add your shop name in **Settings**, then add your customers.

Install newer versions on top of the old one; all records are kept.

## Use it on an iPhone or in a browser

The same app runs in a browser. To host it for free with GitHub Pages:

1. Open **Settings → Pages** in this repository and choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
2. Open `https://<your-user-name>.github.io/<repository-name>/` in Safari, then tap **Share → Add to Home Screen**.

It then opens like an app and works offline. In a browser, records are kept only in that browser on that
device, so use **Save backup now** regularly and keep the file somewhere safe.

## How records are protected (Android)

1. Every change is saved at once inside the app.
2. A second **safe copy** is kept in the app's private storage. If the main records are wiped, the app
   brings them back by itself on the next start.
3. **Earlier copies**: hidden copies, one per day for the last 30 days (Settings → Earlier copies). A restore
   always keeps the current records as a copy first, so it can be undone.
4. **Month backup folders** in the phone's files, updated a few seconds after every change. Each file is read
   back after writing and written again if it does not match. These files stay even if the app is removed.
5. Android's own phone backup includes the app's data when it is turned on in the phone settings.

## Where files are saved (Android)

Settings → **Where your files are** shows these paths. In the Files app, search **Milk Bill Management**.

- `Internal storage › Documents › Milk Bill Management › Backups › 2083-06 Asoj`
  - `Backup - Asoj 2083.json` holds all records and is used with **Settings → Restore from file**.
    It is written into the current month's folder, so every past month keeps its month-end copy.
  - `Milk sheet - Asoj 2083.csv` lists every customer for every day of the month, with totals, rate,
    amount, paid and amount to pay. It opens in Excel.
- `… › Bills › 2083-06 Asoj` holds bill pictures, one per customer.
- `… › Reports` holds month report pictures and Excel (CSV) files.

On a new phone or after reinstalling: open the app, tap **Have a backup file? Restore your records**,
and pick the newest `Backup - … .json`.

## Build it yourself

You need Node.js 18 or newer and Android Studio (it brings Java 21 and the Android SDK).

```bash
npm install
node tests/run-tests.js
node tools/build-www.js
npx cap sync android
```

Then build the Android app from the `android` folder with `gradlew assembleDebug` (for testing)
or `gradlew assembleRelease`. Set `JAVA_HOME` to Android Studio's `jbr` folder first.
The APK is in `android/app/build/outputs/apk/`.

**Signing a release.** Create your own key once and keep it private; it is ignored by git:

```bash
mkdir android-signing
keytool -genkeypair -keystore android-signing/release.jks -alias release -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android-signing/keystore.properties`:

```properties
storeFile=../../android-signing/release.jks
storePassword=your-password
keyAlias=release
keyPassword=your-password
```

Every update must be signed with the same key, or phones will refuse to install it over the old app.

**To change the name or logo:**
- **Logo:** edit `icons/logo.svg`, then run `node tools/make-icons.js`. This makes every icon and opening-screen image.
- **App name:** change it in `js/i18n.js` (`appName`), `index.html`, `manifest.webmanifest`,
  `capacitor.config.json` and `android/app/src/main/res/values/strings.xml`.
- **Phone folder name:** this is `FOLDER` in `js/platform.js`.

### Project layout

- `index.html`, `css/app.css`: the app shell and design system (plain HTML, CSS and JavaScript, no framework).
- `js/app.js`: screens and actions.
- `js/ledger.js`: all calculations (money in paisa).
- `js/nepali-calendar.js`: Bikram Sambat month lengths for 2000–2099. 2083–2087 are checked against
  Hamro Patro; compare and update a year's row when its official calendar is published.
- `js/storage.js`: saving.
- `js/platform.js`: phone files, sharing, backups, back button.
- `js/bill-image.js`: bill and report pictures.
- `js/i18n.js`: English and Nepali text.
- `android/`: the Capacitor Android project. `MainActivity` keeps the app clear of the system bars,
  locks the size and holds the opening screen until the first page is drawn.
- `tests/run-tests.js`: calculation and calendar tests.
- `tools/`:
  - `build-www.js` copies the app for Android;
  - `make-icons.js` makes icons;
  - `bill-preview.html` is a bill check with made-up data.
