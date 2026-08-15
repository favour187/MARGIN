# MARGIN

Most planning apps only track tasks and deadlines. They don't really account for whether you have the time sleep or energy to get through them. MARGIN looks at your actual weekly capacity instead — sleep, commute, existing responsibilities, recovery time — so what you plan is closer to what you can actually do

## Try it

https://favour187.github.io/MARGIN/

## What it does

**Capacity Model**
Works out how much realistic time you have in a week after sleep, commuting and existing responsibilities are accounted for. Not every hour is free time and this tries to reflect that.

**Task Inbox**
A quick place to dump tasks as they come to mind. You don't need to schedule them right away

**Week Lab**
Where tasks get placed against your available capacity so you can see what actually fits before you commit to anything.

**Reset Engine**
Recalculates your plan when things change mid week. Missed a day, need more hours, slept less than planned — the schedule adjusts instead of just falling apart.

**Calm Now**
A quick way to step back when the week starts feeling like too much.

**Support Card**
Short summary of where you stand for the week, what's realistic and what might need to shift.

## Challenges

Figuring out how to actually model "capacity" was the hard part. It's easy to make the math technically correct and still have it feel disconnected from how people experience their time

## Accomplishments

Getting the Reset Engine to recalculate cleanly, and keeping everything running locally without a server, were the two things I was most happy to land.

## What you learned

Building this made it pretty clear how much most planning tools ignore real human limits. A lot of "good" planning is just being honest about capacity not just organizing tasks better.

## Limitations

- Capacity model uses fixed assumptions, doesn't adapt to unusual schedules yet
- No mobile app — browser only for now
- Reset Engine handles common changes but not every edge case

## What's next

- To handle real user
- Maybe cross device sync while keeping data local first
- More personalization in how capacity gets calculated

## Local running instructions

git clone https://github.com/favour187/MARGIN.git
cd MARGIN
open index.html in your browser

## Privacy

Planning data stays on your device where possible. No account required for the core features.

## AI-use disclosure

AI tools were used for part of the development process. All final decisions and implementation were my own.
