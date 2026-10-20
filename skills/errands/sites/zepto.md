# Zepto (zepto.com): browser playbook
Learned from runs on 2026-10-20. Medicines and essentials, delivered in minutes.

- **Slow to render.** The page shell loads first and the content seconds later. Wait 5–30 s before deciding it's blank; reload once if still empty. Read the page with `JSON.stringify(document.body.innerText)` inside an IIFE: a bare evaluate can come back empty.
- **Search directly:** `https://www.zepto.com/search?query=<words>` (e.g. `dolo+500+tablet`); products are links containing `/pn/`.
- **Location first:** click the "Select Location" button (top left), type a short form of the address ("<building>, <area>") into "Search a new address", wait a few seconds, click the matching suggestion. Full long addresses don't match.
- **Cart:** add from the product page; the cart opens at `?cart=open` and shows the bill summary.
- **Login** (needed for checkout): phone number, then an OTP sent by SMS. Enter the phone, request the OTP, then stop and report that you need the OTP.
- Plain paracetamol 500 mg seen: Dolo-500 (15 tablets, ₹14), Paracip-500 (10 tablets, ₹9).
