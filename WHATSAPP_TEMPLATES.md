# Meta WhatsApp Message Templates Guide
**The One Page Plan** | `onepageplan.in`

Use this guide to create and submit your WhatsApp message templates in **Meta WhatsApp Manager** (Meta Business Suite).

---

## 📍 Where to Create Templates

1. Open **Meta WhatsApp Manager**:
   👉 [https://business.facebook.com/wa/manage/message-templates/](https://business.facebook.com/wa/manage/message-templates/)
2. Select your WhatsApp Business Account (WABA): `947406228418551`
3. Click **Create Template** (top right button).

---

## ⚡ Important Rules for Fast Meta Approval
- **Category:** Choose **`UTILITY`** for all webinar confirmations and reminders (Meta approves UTILITY templates in under 5 minutes, and they cost significantly less than Marketing).
- **Language:** Choose **`English`** (Code: `en` or `en_US`).
- **Variables:** Enter sample values for `{{1}}` (e.g. `Milan`) before submitting.
- **Button:** Set Type to **Visit website**, URL Type to **Static**, and URL to `https://onepageplan.in/room`. (Because the button is a Static URL, Meta handles the click directly without needing dynamic URL parameters in the API payload).

---

## 📋 The 6 Templates (Clean Button + LinkedIn Profile)

### 1. `webinar_confirmation` (Immediate Registration Confirmation)
*Dispatched immediately when an attendee registers on the landing page.*

- **Template Name:** `webinar_confirmation`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** None (or Text: `The One Page Plan`)
- **Body:**
```text
Hello {{1}},

Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST.

Tap the "Join Session" button below to access the session room.

In the meantime, feel free to connect with me on LinkedIn to read more about the framework:
https://www.linkedin.com/in/milanaire-me/

Before Saturday, please sit somewhere quiet with a notebook and pen.

See you in the room,
Milan Dodhia
Financial Educator, The One Page Plan
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `Join Session`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/room`
- **Sample Values (Required by Meta):**
  - `{{1}}`: `Milan`

---

### 2. `webinar_reminder_2h` (2 Hours Before Masterclass)
*Dispatched Saturday at 5:00 PM IST.*

- **Template Name:** `webinar_reminder_2h`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** Text: `Starting in 2 Hours`
- **Body:**
```text
Hello {{1}},

We start The Money Reality Masterclass in exactly two hours (7:00 PM IST).

Have your notepad and pen ready. Tap the button below to enter the room.

See you shortly,
Milan Dodhia
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `Enter Room`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/room`
- **Sample Values:**
  - `{{1}}`: `Milan`

---

### 3. `webinar_reminder_15m` (15 Minutes Before Masterclass)
*Dispatched Saturday at 6:45 PM IST.*

- **Template Name:** `webinar_reminder_15m`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** None
- **Body:**
```text
Hello {{1}},

The Money Reality Masterclass begins in 15 minutes.

Tap the button below to join the room. We start promptly at 7:00 PM IST.

See you inside,
Milan Dodhia
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `Join Live Now`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/room`
- **Sample Values:**
  - `{{1}}`: `Milan`

---

### 4. `webinar_live_now` (At Starting Bell)
*Dispatched Saturday at 7:00 PM IST.*

- **Template Name:** `webinar_live_now`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** Text: `We Are Live`
- **Body:**
```text
Hello {{1}},

The Money Reality Masterclass is live right now.

Tap the button below to join the room.

See you inside,
Milan Dodhia
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `Join Masterclass`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/room`
- **Sample Values:**
  - `{{1}}`: `Milan`

---

### 5. `webinar_followup` (Post-Session Notes & Next Steps)
*Dispatched after the masterclass concludes.*

- **Template Name:** `webinar_followup`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** None
- **Body:**
```text
Hello {{1}},

Thank you for attending The Money Reality Masterclass.

Tap the button below to view your session summary and next steps.

You can also read my latest financial notes and connect on LinkedIn:
https://www.linkedin.com/in/milanaire-me/

If you have any questions, reply directly to this message.

Warmly,
Milan Dodhia
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `View Summary`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/course`
- **Sample Values:**
  - `{{1}}`: `Milan`

---

### 6. `course_purchase_confirmation` (Order Confirmation)
*Dispatched when an attendee purchases The Calm Money System.*

- **Template Name:** `course_purchase_confirmation`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** Text: `Welcome to The Calm Money System`
- **Body:**
```text
Hello {{1}},

Thank you for joining The Calm Money System. Your enrollment is confirmed.

Tap the button below to access your learning portal.

Reply to this chat anytime if you need help with your access.

Warmly,
Milan Dodhia
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `Open Portal`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/course`
- **Sample Values:**
  - `{{1}}`: `Milan`

---

### 7. `webinar_missed` (Non-Attendee Follow-up / Missed Session)
*Dispatched on Sunday morning to registrants who did NOT join the live room (verified via Webinar.gg webhook).*

- **Template Name:** `webinar_missed`
- **Category:** `UTILITY`
- **Language:** `English`
- **Header:** None (or Text: `The One Page Plan`)
- **Body:**
```text
Hello {{1}},

You registered for The Money Reality Masterclass and couldn't make it. That happens, and no guilt about a Saturday evening.

Good news: the session runs again this Saturday at 7:00 PM IST, and your seat carries over automatically. You do not need to register again.

In the meantime, here is the one exercise the whole session is built on:
Take a blank sheet and list everything you own and everything you owe. Next to each, write one line explaining what it actually does for your family. If you can't write that line, that is where your money is quietly leaking.

Tap the button below to bookmark the room for this Saturday, or connect on LinkedIn to read more:
https://www.linkedin.com/in/milanaire-me/

See you this Saturday,
Milan Dodhia
```
- **Button (Required):**
  - Type: **Visit website**
  - Button text: `Join Next Saturday`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/room`
- **Sample Values (Required by Meta):**
  - `{{1}}`: `Milan`

---

## 🛠️ Code Mapping Reference
In `src/services/whatsapp/whatsapp-nurture.server.ts`, these template names map directly:

| Message Key | Default Template Name | Overriding Environment Variable | Target Audience |
| :--- | :--- | :--- | :--- |
| `confirmation` | `webinar_confirmation` | `WHATSAPP_TEMPLATE_CONFIRMATION` | On landing page registration |
| `reminder-2h` | `webinar_reminder_2h` | `WHATSAPP_TEMPLATE_REMINDER_2H` | Saturday 5:00 PM IST |
| `reminder-15m` | `webinar_reminder_15m` | `WHATSAPP_TEMPLATE_REMINDER_15M` | Saturday 6:45 PM IST |
| `live` | `webinar_live_now` | `WHATSAPP_TEMPLATE_LIVE` | Saturday 7:00 PM IST |
| `followup` | `webinar_followup` | `WHATSAPP_TEMPLATE_FOLLOWUP` | Sunday morning (Attended webinar) |
| `no-show` | `webinar_missed` | `WHATSAPP_TEMPLATE_NO_SHOW` | Sunday morning (Missed / Did not attend) |
| `purchase` | `course_purchase_confirmation` | `WHATSAPP_TEMPLATE_PURCHASE` | After buying The Calm Money System |
