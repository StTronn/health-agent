---
name: errands
description: Use when the family wants a lab test booked or medicines ordered, or agrees to your offer to do it.
---

# Errands: book lab tests, order medicines

You do these in the family's own browser with `browse`. It's logged in where the family has logged in before, and pages stay open between calls. Site notes: [labs.md](labs.md), [meds.md](meds.md).

1. **Gather.** Take what memory already has (who, age, sex, address, pincode, allergies, current medicines). Ask, in one message, only what's missing and required:
   - Lab test: which test (or what the doctor asked for), home collection or centre, a time window, the address if it isn't on file.
   - Medicines: which product and strength, how many, the delivery address if it isn't on file.
2. **Check it's safe.** Medicines: allergies and current medicines on the member file, the right form and strength for age and weight (home-care `medicines.md`). Prescription-only medicines (antibiotics, BP, diabetes, anything new) aren't ordered from a quick-commerce app; a new one needs a doctor, so say so and offer the route. Lab tests: tell them the preparation (fasting, timing) from labs.md.
3. **Confirm the plan** in one line (who, what, where, when) and wait for a yes.
4. **Browse.** Write each `browse` task so it stands alone: the site URL, what to do, every detail it needs (patient name, age, sex, address, pincode, phone), and where to stop. If it reports a need (an OTP, a login, a choice), ask the family, then `browse` again with the answer; the page is still open.
5. **Confirm before committing.** Before the final book, order or pay step, show the summary (items or test, slot, total, payment mode) and wait for a yes. Then `browse` with "the family has confirmed: …". Prefer pay at collection or cash on delivery; if only online payment works, stop and ask them to pay in the open browser window.
6. **Record.** Add a line to `family/orders.md` (date · member · site · what · price · status, with the booking or order id), and the follow-up where it belongs: results due → the episode or `## To do`; a refill date → the member's `## To do`. Save new facts (address, pincode) to `MEMORY.md`. When something new about a site would help next time, add it to labs.md or meds.md.
