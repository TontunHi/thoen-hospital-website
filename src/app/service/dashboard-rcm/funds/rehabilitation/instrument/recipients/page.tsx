import { redirect } from 'next/navigation'

export default function InstrumentRecipientsRedirectPage() {
  redirect('/service/dashboard-rcm/funds/instrument')
}
