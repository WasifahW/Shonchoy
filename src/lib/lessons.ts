export interface Lesson {
  id: string
  topic: string
  icon: string // Font Awesome class
  title: string
  minutes: number
  bigIdea: string
  body: string[]
  example: string
  tryThis: string
}

export const lessons: Lesson[] = [
  {
    id: 'saving',
    topic: 'Saving',
    icon: 'fa-piggy-bank',
    title: 'Pay yourself first',
    minutes: 2,
    bigIdea: 'Saving is easier when you do it first, not last.',
    body: [
      'Most of us try to save what is left at the end of the month — and often nothing is left.',
      'Instead, the day money comes in, put a small amount aside before you spend on anything else. Treat it like a bill you owe to your future self.',
      'It does not have to be big. What matters most is doing it every time.'
    ],
    example: 'If you earn ৳20,000 and put ৳1,000 aside on payday, you will have ৳12,000 in one year — without even thinking about it.',
    tryThis: 'Choose one small amount you can save every payday. Write it down here in $honchoy.'
  },
  {
    id: 'emergency',
    topic: 'Saving',
    icon: 'fa-umbrella',
    title: 'A cushion for bad days',
    minutes: 2,
    bigIdea: 'An emergency fund keeps a surprise from turning into a loan.',
    body: [
      'Life brings surprises: a doctor visit, a broken phone, a slow month at work.',
      'An emergency fund is money you keep only for these moments. It means you do not have to borrow at high interest when trouble comes.',
      'A good first target is one month of your basic costs. Later, you can build it up to three months.'
    ],
    example: 'If rent and food cost ৳9,000 a month, a first cushion of ৳9,000 can carry you through one hard month.',
    tryThis: 'Keep your cushion somewhere separate — a different account or envelope — so you are not tempted to spend it.'
  },
  {
    id: 'interest',
    topic: 'Interest',
    icon: 'fa-percent',
    title: 'Interest: the price of money',
    minutes: 2,
    bigIdea: 'Interest can work for you or against you.',
    body: [
      'Interest is the extra money paid for using someone else’s money.',
      'When you save in a bank, the bank pays you interest — your money grows. When you borrow, you pay interest — the loan costs more than you took.',
      'Over time, interest is added on top of interest. This is called “compounding”. It makes savings grow faster, and it makes unpaid loans grow faster too.'
    ],
    example: 'Borrow ৳5,000 at 20% a year, and in one year you owe about ৳1,000 extra — just for borrowing.',
    tryThis: 'Before any loan, ask: “How much will I pay back in total?” — not just “How much is each payment?”'
  },
  {
    id: 'debt',
    topic: 'Debt',
    icon: 'fa-hand-holding-dollar',
    title: 'Getting out of debt, step by step',
    minutes: 3,
    bigIdea: 'Pay the most expensive loan first.',
    body: [
      'Not all loans are the same. The one with the highest interest rate is costing you the most each month.',
      'Always pay at least the minimum on every loan so you avoid extra fees. Then put any extra money toward the loan with the highest rate.',
      'When that one is gone, move the same money to the next one. It feels slow at first, then it speeds up.',
      'Try not to take a new loan to pay an old one — it usually adds more interest.'
    ],
    example: 'On a ৳5,000 loan at 20%, paying ৳700 a month instead of ৳500 clears it about 4 months sooner and saves around ৳150 in interest.',
    tryThis: 'List your loans from highest to lowest interest rate. Circle the top one — that is your target.'
  },
  {
    id: 'inflation',
    topic: 'Inflation',
    icon: 'fa-basket-shopping',
    title: 'Why prices keep going up',
    minutes: 2,
    bigIdea: 'Inflation means the same money buys a little less each year.',
    body: [
      'Remember when rice or a bus ride cost less? That slow rise in prices is called inflation.',
      'If your money sits in a box at home, it stays the same number — but it buys less and less over time.',
      'This is why it helps to keep savings somewhere that earns some interest, like a bank savings account or a trusted savings scheme.'
    ],
    example: 'If prices rise 8% in a year, groceries that cost ৳3,000 today may cost about ৳3,240 next year.',
    tryThis: 'When you plan a goal for next year, add a little extra to the price to allow for inflation.'
  },
  {
    id: 'investing',
    topic: 'Investing',
    icon: 'fa-seedling',
    title: 'Investing: planting money seeds',
    minutes: 3,
    bigIdea: 'Investing means putting money to work so it can grow over time.',
    body: [
      'Saving keeps money safe. Investing aims to grow it — but the value can go up and down along the way.',
      'Common options include fixed deposits and government savings certificates (lower risk), and shares or funds (higher risk, higher possible reward).',
      'Only invest money you will not need soon. Build your emergency cushion and pay off costly loans first.',
      'Higher possible reward always comes with higher risk. Anyone who says otherwise is not being honest.'
    ],
    example: 'A small business, like buying a sewing machine to earn from tailoring, is also a kind of investment — in yourself.',
    tryThis: 'Before investing, ask: “Can I afford to leave this money alone for at least a year?”'
  },
  {
    id: 'diversification',
    topic: 'Diversification',
    icon: 'fa-egg',
    title: 'Don’t put all your eggs in one basket',
    minutes: 2,
    bigIdea: 'Spreading your money out keeps one problem from wiping you out.',
    body: [
      'If you carry all your eggs in one basket and drop it, you lose them all. Money works the same way.',
      'Diversification simply means spreading your money across different places — for example, some in savings, some in a deposit, some in your business.',
      'It also applies to income: having more than one way to earn keeps you steadier if one stops.'
    ],
    example: 'Instead of putting ৳10,000 into one scheme, you might keep ৳5,000 in savings, ৳3,000 in a fixed deposit and use ৳2,000 to grow your small business.',
    tryThis: 'Look at where your money is today. Is it all in one place? Pick one small way to spread it out.'
  },
  {
    id: 'budget',
    topic: 'Budgeting',
    icon: 'fa-list-check',
    title: 'Know where your money goes',
    minutes: 2,
    bigIdea: 'You can’t change what you can’t see.',
    body: [
      'A budget is just a plan for your money: what comes in, and where it goes.',
      '“Fixed” costs stay the same each month, like rent. “Variable” costs change, like food or transport — these are usually the easiest to adjust.',
      'Writing down what you spend for even one week often shows small leaks you did not notice.'
    ],
    example: 'Saving ৳50 a day on snacks or tea adds up to about ৳1,500 a month — enough for a nice step toward a goal.',
    tryThis: 'Log every expense in $honchoy for 7 days, then look for one small leak to fix.'
  }
]
