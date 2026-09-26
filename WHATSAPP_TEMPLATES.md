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
- **Variables:** Enter sample values for every `{{1}}` and `{{2}}` before submitting.

---

## 📋 The 6 Required Templates

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

Here is your link to join the live session:
{{2}}

Before Saturday, please sit somewhere quiet with a notebook and pen.

See you in the room,
Milan Dodhia
Financial Educator, The One Page Plan
```
- **Button (Optional):**
  - Type: **Visit website**
  - Button text: `Join Session`
  - URL type: **Static**
  - Website URL: `https://onepageplan.in/room`
- **Sample Values (Required by Meta):**
  - `{{1}}`: `Milan`
  - `{{2}}`: `https://onepageplan.in/room`

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

Have your notepad ready. Here is your direct link to enter:
{{2}}

See you shortly,
Milan Dodhia
```
- **Button (Optional):**
  - Type: **Visit website**
  - Button text: `Enter Room`
  - Website URL: `https://onepageplan.in/room`
- **Sample Values:**
  - `{{1}}`: `Milan`
  - `{{2}}`: `https://onepageplan.in/room`

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

Click here to enter the room:
{{2}}

We start promptly at 7:00 PM IST.

Milan Dodhia
```
- **Button (Optional):**
  - Type: **Visit website**
  - Button text: `Join Live Now`
  - Website URL: `https://onepageplan.in/room`
- **Sample Values:**
  - `{{1}}`: `Milan`
  - `{{2}}`: `https://onepageplan.in/room`

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

Join the room here:
{{2}}

See you inside,
Milan Dodhia
```
- **Button (Optional):**
  - Type: **Visit website**
  - Button text: `Join Masterclass`
  - Website URL: `https://onepageplan.in/room`
- **Sample Values:**
  - `{{1}}`: `Milan`
  - `{{2}}`: `https://onepageplan.in/room`

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

You can access your session summary and next steps here:
{{2}}

If you have any questions, reply directly to this message.

Warmly,
Milan Dodhia
```
- **Button (Optional):**
  - Type: **Visit website**
  - Button text: `View Summary`
  - Website URL: `https://onepageplan.in/course`
- **Sample Values:**
  - `{{1}}`: `Milan`
  - `{{2}}`: `https://onepageplan.in/course`

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

Access your course portal and modules here:
{{2}}

Reply to this chat anytime if you need help with your access.

Warmly,
Milan Dodhia
```
- **Button (Optional):**
  - Type: **Visit website**
  - Button text: `Open Portal`
  - Website URL: `https://onepageplan.in/course`
- **Sample Values:**
  - `{{1}}`: `Milan`
  - `{{2}}`: `https://onepageplan.in/course`

---

## 🛠️ Code Mapping Reference
In `src/services/whatsapp/whatsapp-nurture.server.ts`, these template names map directly:

| Message Key | Default Template Name | Overriding Environment Variable |
| :--- | :--- | :--- |
| `confirmation` | `webinar_confirmation` | `WHATSAPP_TEMPLATE_CONFIRMATION` |
| `reminder-2h` | `webinar_reminder_2h` | `WHATSAPP_TEMPLATE_REMINDER_2H` |
| `reminder-15m` | `webinar_reminder_15m` | `WHATSAPP_TEMPLATE_REMINDER_15M` |
| `live` | `webinar_live_now` | `WHATSAPP_TEMPLATE_LIVE` |
| `followup` | `webinar_followup` | `WHATSAPP_TEMPLATE_FOLLOWUP` |
| `purchase` | `course_purchase_confirmation` | `WHATSAPP_TEMPLATE_PURCHASE` |
