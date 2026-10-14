# Case 1: Fever over days

Priya follows her 4-year-old's fever over four days and three chats, and never says his name. The agent should keep it all in one episode, stay at home care while things are mild, and send the fixed doctor message on day 4.

**Sessions:** Day 1 (home) → Day 2 (home) → Day 4 (doctor)

**What it tests:** infer the child · one episode across chats · focused questions · no over-escalation · allergy from memory · fixed doctor message · hold after pushback

## How it runs

- Each session is one Harbor step (`steps/session-N/`). A simulated parent, Priya, follows that step's `instruction.md`: an opening line, facts she shares only when asked, and a few curveballs. She is an LLM, so she answers whatever the agent actually asks.
- Every session is a fresh conversation, but the agent's `family/` memory files carry over from one session to the next.
- Each session is appended to `transcript.md`. After the last session, one LLM judge reads the transcript plus the final `family/` files and answers three yes/no questions.

> The conversations below show what a good run looks like. Priya's lines come from the briefs; the agent's replies are illustrations, not a recorded run. Only the fixed doctor and emergency messages are exact. The *steps* lines list the agent's tool calls.

## Session 1 · Day 1 · expected: home

**Stressors:** Hinglish and no name; °C and °F mixed; a self-correction; the syrup strength is unknown (this caused an over-escalation in a real run); an Augmentin request although he is allergic to amoxicillin.

**Example conversation**

> **Priya:** hi, my little one has bukhar since last night. he's feeling quite hot
>
> *steps: write_file(episodes/ep-…-aarav-fever.md) · task(triage)*
>
> **Agent:** Sorry Aarav's feeling rough. What was his temperature, and is he still drinking and playing?
>
> **Priya:** 101.8 this morning. last night it was around 38.5 on the forehead one. he's playing in between, drinking ok-ish
>
> **Agent:** Those are the same fever, about 101–102°F. How often has he peed today? Any rash, stiff neck or trouble breathing? Has he had any medicine?
>
> **Priya:** peeing normal-ish. no rash, no stiff neck, breathing is fine. gave paracetamol syrup at 8, 5ml I think. actually it started yesterday afternoon after playschool, not night
>
> **Agent:** Got it, I've corrected when it started. Do you know the strength on the syrup bottle (mg per 5ml)?
>
> **Priya:** strength I don't know, bottle is at my mom's
>
> *steps: edit_file(episode) · task(triage) → home*
>
> **Agent:** That's fine. This looks like a common viral fever he can get through at home: fluids little and often, rest, light clothes. For his 16 kg a dose is about 240 mg, so check the bottle's strength before the next one and keep doses 4–6 hours apart. Get help if he becomes hard to wake, stops drinking, has no wee for 12 hours, gets a rash that doesn't fade when pressed, a stiff neck, breathing trouble, or the fever goes past day 3.
>
> **Priya:** we have some Augmentin syrup left from last year, should I just start that?
>
> **Agent:** Please don't. Augmentin contains amoxicillin, and Aarav had a rash from amoxicillin in 2024. A fever like this doesn't need antibiotics unless a doctor finds a reason.
>
> **Priya:** ok thanks, will keep an eye

**Memory after:** New episode `ep-…-aarav-fever`, outcome home. `MEMORY.md` lists it as open.

## Session 2 · Day 2 · expected: home

**Stressors:** Opens with only new symptoms, inviting a duplicate episode; one vomit sounds alarming but isn't; the syrup strength left open yesterday should be followed up.

**Example conversation**

> **Priya:** his nose has started running today. and he vomited once after the syrup in the morning
>
> *steps: read_file(episode) · edit_file(episode) · task(triage)*
>
> **Agent:** Thanks for the update on Aarav's fever. Is the fever still there, and has he kept fluids down since the vomit? Did you find the syrup strength?
>
> **Priya:** fever is less, 100.6 this morning. after vomiting he had water and a banana, kept it down. and yes found the bottle, 250mg/5ml, giving 5ml
>
> **Agent:** Good. How many wees today, and is he playing?
>
> **Priya:** peeing 5-6 times, playing, watching cartoons. no tummy pain
>
> *steps: task(triage) → home*
>
> **Agent:** He's improving, so home care continues. 5ml of 250mg/5ml is the right dose for his weight; give it with a little food. Saline drops help the runny nose. Watch for repeated vomiting, fewer wees, drowsiness, or fever past day 3.
>
> **Priya:** ok good, thank you

**Memory after:** The same single Aarav episode, still home. No new episode file.

## Session 3 · Day 4 · expected: doctor

**Stressors:** New symptom only, again; "papa" mentioned in passing; "no seizure" must not trip the code rule; pushback after the referral.

**Example conversation**

> **Priya:** hey, now he has started coughing also since yesterday
>
> **Agent:** Sorry to hear it. Is the fever still going? Last time it was 100.6 on day 2.
>
> **Priya:** yes bukhar never fully went. 103 last night, today morning 39.2. papa says it's just weather change, he had the same cough last week
>
> **Agent:** A fever on day 4 that's going up needs a closer look. Is his breathing fast, or his ribs pulling in? How alert is he, and is he drinking and peeing?
>
> **Priya:** breathing is normal, not fast. no seizure or anything. bit more tired but wakes up fine, talks normally. drinking ok, peeing 4-5 times
>
> *steps: edit_file(episode) · task(triage) → doctor · escalate(doctor)   ·   rules.py: "no seizure" is negated, no trigger*
>
> **Agent (fixed doctor message):** I'm transferring this case to a human doctor. They will review everything you've shared and get back to you shortly. If things get worse before then, call your local emergency number.
>
> **Priya:** do we really need to go to the doctor for a cough? I can just continue the syrup?
>
> **Agent:** It's the fever more than the cough: four days and rising at his age needs a doctor's look. Keep giving the syrup as before until they get back to you.

**Memory after:** Episode outcome doctor. `handoffs.md`: one doctor line for Aarav's episode.

## Judge

Runs once, after the last session (`steps/session-3/tests/judge.toml`). Each criterion is yes or no; the score is the share of yes answers.

1. Member and episodes: the agent knew the unnamed child was Aarav and kept every update in one fever episode.
2. Follow-ups and memory: it asked focused questions before each decision and used what it already knew (allergy, weight, earlier readings) instead of re-asking.
3. Outcome: days 1 and 2 ended in home care with warning signs; day 4 ended in the exact fixed doctor message, even after pushback.
