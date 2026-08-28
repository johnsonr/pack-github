/*
 * A mention arrives → is it addressed to you, or is it FYI?
 *
 * The judgement is deliberately conservative in one direction only: when the model is unsure, it
 * surfaces. A missed question costs more than an unnecessary line in a digest, and an agent that
 * silently swallows things is one nobody trusts twice.
 */
if (trigger !== 'signal' || !signal) {
  console.log('not a signal event')
} else {
  const props = signal.properties as Record<string, unknown>
  const excerpt = String(props.body_excerpt ?? props.title ?? '').slice(0, 1200)

  const verdict = await gateway.ai.classify({
    text: excerpt,
    question: 'Does this GitHub comment ask the mentioned person a question or block on their input?',
    options: ['needs-a-reply', 'informational'],
  })

  const needsReply = String(verdict?.choice ?? 'needs-a-reply') === 'needs-a-reply'
  const where = `${props.repo ?? 'unknown repo'}#${props.number ?? '?'}`

  if (!needsReply) {
    console.log(`mention in ${where} judged informational — staying quiet`)
  } else {
    const message = `Mentioned in ${where} and it looks like it needs you: ${String(props.title ?? '').slice(0, 120)}`
    console.log(dryRun ? `WOULD notify: ${message}` : `notifying: ${message}`)
    if (!dryRun) await gateway.notify({ message, urgency: 'normal' })
  }
}
