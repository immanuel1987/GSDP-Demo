import { useState } from 'react'

export function SubscribeStrip({ onToast }) {
  const [email, setEmail] = useState('')

  return (
    <div className="border-t-[3px] border-sdb-orange bg-gradient-to-br from-[#002240] to-sdb-blue px-4 py-10 sm:px-8 lg:px-14">
      <div className="flex flex-wrap items-center gap-8">
        <div className="min-w-[200px] flex-1">
          <div className="mb-1.5 font-serif text-lg font-bold text-white">
            Stay connected with the Salesian mission
          </div>
          <div className="text-[13px] text-white/65">
            Get news, resources, and updates from 136 nations — directly to your inbox.
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2.5">
          <label htmlFor="subscribe-email" className="sr-only">
            Email address
          </label>
          <input
            id="subscribe-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            className="w-full min-w-[200px] max-w-[240px] rounded-lg border-[1.5px] border-white/30 bg-white/10 px-4 py-2.5 font-sans text-[13px] text-white placeholder:text-white/50 focus:border-sdb-orange focus:outline-none sm:w-[240px]"
          />
          <button
            type="button"
            onClick={() => onToast?.('✉ Subscribed! Welcome to the Salesian network.')}
            className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-sdb-orange px-5 py-2.5 font-sans text-[13px] font-semibold text-white transition-[filter] hover:brightness-110"
          >
            Subscribe
          </button>
        </div>
        <div className="ml-0 flex flex-wrap gap-4 lg:ml-auto">
          <a
            href="https://www.youtube.com/user/DonBoscoSouthAsia"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-white/65 no-underline transition-colors hover:text-white"
          >
            ▶ YouTube
          </a>
          <a
            href="https://www.donboscosouthasia.org/SocialMediaIndex"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-white/65 no-underline transition-colors hover:text-white"
          >
            ⊞ Social Media
          </a>
          <a
            href="https://open.spotify.com/show/6xwGk1B4ccKPhzpi4sjpSg"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-white/65 no-underline transition-colors hover:text-white"
          >
            🎙 Podcast
          </a>
        </div>
      </div>
    </div>
  )
}
