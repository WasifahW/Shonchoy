export interface RedFlag {
  id: string
  icon: string
  title: string
  whatItSounds: string
  whyRisky: string
  whatToDo: string
  /** A yes/no question for the self-check */
  question: string
  weight: number // how serious, 1–3
  /** Lowercase phrases that hint at this flag in pasted text */
  patterns: RegExp[]
}

export const redFlags: RedFlag[] = [
  {
    id: 'guaranteed',
    icon: 'fa-sack-dollar',
    title: 'Guaranteed high returns',
    whatItSounds: '“Double your money in 30 days!” “100% safe, no risk.”',
    whyRisky: 'Real investments can go up and down. Nobody honest can promise big profits with no risk.',
    whatToDo: 'If the promise sounds too good to be true, it almost always is. Walk away.',
    question: 'Do they promise big profits, or say there is no risk at all?',
    weight: 3,
    patterns: [
      /guarantee(d)?/i, /double (your )?money/i, /(no|zero) risk/i, /risk[- ]free/i,
      /100\s?% (safe|profit|return)/i, /\b\d{2,3}\s?% (profit|return|interest)/i,
      /(daily|weekly) (profit|return|income)/i, /get rich/i, /triple/i
    ]
  },
  {
    id: 'pressure',
    icon: 'fa-stopwatch',
    title: 'Pressure to decide fast',
    whatItSounds: '“Only today!” “Last 3 spots — pay now or lose it.”',
    whyRisky: 'Scammers rush you so you don’t have time to think, check or ask someone you trust.',
    whatToDo: 'A real offer will still be there tomorrow. Take your time and talk to family or a friend.',
    question: 'Are they rushing you, or saying the offer ends very soon?',
    weight: 2,
    patterns: [
      /(only|just) today/i, /act (now|fast)/i, /limited (time|offer|slots?|seats?)/i,
      /last (chance|\d+ (spots?|slots?|seats?))/i, /hurry/i, /expires? (today|tonight|soon)/i,
      /right now/i, /immediately/i, /urgent/i, /don'?t (tell|miss)/i
    ]
  },
  {
    id: 'upfront',
    icon: 'fa-money-bill-transfer',
    title: 'Fees before you get anything',
    whatItSounds: '“Pay a small processing fee to release your loan / prize.”',
    whyRisky: 'Real lenders take fees from the loan itself or after approval. Asking for money first is a classic trick — and the fees often keep coming.',
    whatToDo: 'Never pay to receive a loan, a job or a prize. Stop and check.',
    question: 'Do you have to pay a fee first to get a loan, job, prize or profit?',
    weight: 3,
    patterns: [
      /(processing|registration|joining|activation|release|advance|upfront|service) (fee|charge|payment)/i,
      /pay (a )?(small )?fee/i, /send (money|payment|taka|tk)/i, /deposit first/i,
      /you('ve| have)? won/i, /lottery/i, /claim (your )?prize/i, /send (it )?(via|by|through|to|on) (bkash|nagad|rocket)/i, /gift card/i
    ]
  },
  {
    id: 'unregistered',
    icon: 'fa-id-card',
    title: 'Unregistered agent or company',
    whatItSounds: '“We don’t need a licence.” “Just trust me, I’m a friend of a friend.”',
    whyRisky: 'Registered banks, lenders and brokers are checked by the government. If they are not registered, you have no protection if things go wrong.',
    whatToDo: 'Ask for their licence or registration number and check it with the official regulator (in Bangladesh: Bangladesh Bank, BSEC or MRA).',
    question: 'Are you unsure whether the person or company is officially registered?',
    weight: 3,
    patterns: [
      /no (licen[cs]e|registration|paperwork|documents?) (needed|required)/i,
      /trust me/i, /(whats ?app|telegram|facebook|imo) (group|only|channel)/i,
      /(personal|my own) (account|number)/i, /not registered|unregistered/i
    ]
  },
  {
    id: 'recruit',
    icon: 'fa-people-group',
    title: 'Earn by bringing in others',
    whatItSounds: '“Bring 5 friends and earn a bonus for each one.”',
    whyRisky: 'When profits come from new members instead of real work or products, the scheme collapses — and most people lose their money.',
    whatToDo: 'Be very careful of any plan where the main way to earn is recruiting.',
    question: 'Do you earn mainly by bringing in new people?',
    weight: 2,
    patterns: [/refer(ral)?/i, /recruit/i, /bring (\d+ )?(friends|people|members)/i, /downline|network marketing|mlm|chain/i]
  },
  {
    id: 'secrets',
    icon: 'fa-user-secret',
    title: 'Asking for PIN, OTP or passwords',
    whatItSounds: '“Share the code we just sent you to confirm your account.”',
    whyRisky: 'Your PIN or one-time code (OTP) is the key to your money. With it, someone can empty your account.',
    whatToDo: 'Never share your PIN, OTP or password — not even with someone who says they are from your bank.',
    question: 'Are they asking for your PIN, OTP, password or ID card photo?',
    weight: 3,
    patterns: [/\bpin\b/i, /\botp\b/i, /password/i, /verification code/i, /(nid|id card) (photo|copy|number)/i, /share (the )?code/i]
  },
  {
    id: 'vague',
    icon: 'fa-circle-question',
    title: 'Can’t explain how it makes money',
    whatItSounds: '“It’s a secret system.” “Don’t worry about the details.”',
    whyRisky: 'An honest business can tell you clearly how it earns. Vague answers usually hide something.',
    whatToDo: 'If you can’t explain it simply to a friend, don’t put money in.',
    question: 'Is it unclear how the business actually earns its money?',
    weight: 1,
    patterns: [/secret (system|method|formula|trick)/i, /don'?t worry about/i, /forex|binary|trading bot/i]
  }
]

export interface ScamCheckResult {
  level: 'low' | 'medium' | 'high'
  headline: string
  advice: string
  matched: { id: string; title: string; whyRisky: string; whatToDo: string; evidence: string[] }[]
}

function resultFor(ids: Set<string>, evidence: Map<string, string[]>): ScamCheckResult {
  const matched = redFlags.filter((f) => ids.has(f.id))
  const weight = matched.reduce((s, f) => s + f.weight, 0)
  const level: ScamCheckResult['level'] = weight >= 4 ? 'high' : weight >= 2 ? 'medium' : 'low'
  const headline =
    level === 'high' ? 'This looks like a scam. Please don’t send money.' :
    level === 'medium' ? 'Be careful — we see warning signs.' :
    matched.length ? 'Mostly okay, but one thing to check.' : 'We didn’t spot common red flags.'
  const advice =
    level === 'high' ? 'Stop all contact, don’t share any codes, and talk to someone you trust. You can report it to your bank or the police.' :
    level === 'medium' ? 'Take your time. Ask for their registration, check it with the official regulator, and talk it over with family.' :
    'That’s a good sign, but no checker is perfect. Still verify who they are before paying anything.'
  return {
    level, headline, advice,
    matched: matched.map((f) => ({ id: f.id, title: f.title, whyRisky: f.whyRisky, whatToDo: f.whatToDo, evidence: evidence.get(f.id) ?? [] }))
  }
}

/** Check by yes/no answers (ids of flags the user said "yes" to). */
export function checkAnswers(yesIds: string[]): ScamCheckResult {
  const valid = new Set(yesIds.filter((id) => redFlags.some((f) => f.id === id)))
  return resultFor(valid, new Map())
}

/** Check a pasted message for phrases that match common red flags. */
export function checkText(text: string): ScamCheckResult {
  const t = (text ?? '').slice(0, 5000)
  const ids = new Set<string>()
  const evidence = new Map<string, string[]>()
  for (const f of redFlags) {
    const hits: string[] = []
    for (const p of f.patterns) {
      const m = t.match(p)
      if (m && !hits.some((h) => h.toLowerCase() === m[0].toLowerCase())) hits.push(m[0])
    }
    if (hits.length) {
      ids.add(f.id)
      evidence.set(f.id, hits.slice(0, 3))
    }
  }
  return resultFor(ids, evidence)
}
