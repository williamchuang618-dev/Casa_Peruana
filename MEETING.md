# Running La Casa Peruana at a meeting

No hosting, no accounts to set up. Your laptop serves the app and everyone on
the same wifi opens it on their phone.

## Start it

```bash
cd ~/club-attendance
npm run share
```

It prints the address to give people, something like:

```
      http://10.0.0.107:5240
```

Write that on the whiteboard. Everyone types it into their phone browser.

**The address changes on a different network.** Campus wifi today and your
apartment tonight will not be the same number, so run the command and read the
banner each time rather than reusing an old address.

## Before the first meeting

- The **first time** you run it, macOS asks whether to allow incoming
  connections. Say **Allow**. If you say no, phones cannot reach it and the
  only fix is System Settings → Network → Firewall.
- Test it on your own phone first, standing next to the laptop. If the page
  loads and you can sign in, everyone else will be fine.

## While the meeting runs

- Keep the terminal window open and **the laptop awake** — closing the lid stops
  the server and everyone's page dies mid-roll-call. Plug it in and set
  System Settings → Lock Screen → turn display off after: Never for the meeting.
- Stay on the same wifi. If your laptop drops and reconnects the address can
  change, so re-run `npm run share` and read the new one.
- `Ctrl+C` in the terminal stops sharing.

## Getting your club in

1. **You** sign up first and create the club — the first account owns it.
2. Members → **Paste a roster** takes `Name, email` rows straight from a
   spreadsheet, so you can load everyone at once.
3. Give people the **join code** from Settings. They sign up and enter it.
4. Officers get their roles from each member's profile page.

## Taking attendance

Events → open the event → the roll call is four buttons per person. On a phone
they sit across the full width, which is deliberate: they are meant to be
thumbed quickly while people walk in.

- **Mark remaining present** is the fast path — flip the few exceptions first,
  then press it.
- Leaving someone blank keeps them "not recorded". It never counts as an
  absence, so an event you forget to record cannot silently punish anybody.
- Members can self check-in with the event code shown on the event page, and
  you review the result afterwards.

## What this setup cannot do

It only works **while your laptop is running and people are on your wifi**.
Nobody can check their attendance from their dorm at midnight, and if your
laptop sleeps the site is gone.

That is the trade for having zero setup. When you want a real address that works
anywhere, `DEPLOY.md` walks through putting it on the internet properly — the
database moves to Postgres and Vercel serves it. Nothing about the app changes;
you just stop being the server.
