export function Hero() {
  return (
    <header className="bg-pine text-snow relative overflow-hidden pt-16 pb-14">
      <svg
        className="absolute inset-0 w-full h-full z-0"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <g opacity="0.5" stroke="#D99B12" strokeWidth="1.5" fill="none" strokeDasharray="2 7">
          <path d="M0,40 Q250,10 500,40 T1000,40" />
          <path d="M0,68 Q250,40 500,68 T1000,68" />
        </g>
        <polygon
          points="0,300 0,160 120,60 230,150 310,90 430,180 520,100 640,190 760,120 880,200 1000,140 1000,300"
          fill="#2C4C3A"
        />
        <polygon
          points="0,300 0,210 90,150 190,220 300,140 410,215 540,130 660,210 790,150 900,225 1000,175 1000,300"
          fill="#213E2E"
        />
        <polygon
          points="0,300 0,255 140,190 260,250 400,180 560,255 700,195 850,260 1000,210 1000,300"
          fill="#152A20"
        />
      </svg>
      {/* A perfect circle, unlike the mountains above: `preserveAspectRatio="none"`
          stretches anything drawn inside that SVG's non-square viewBox into an
          oval whenever the header's aspect ratio doesn't match 1000:300, which
          is most of the time. Sitting outside that viewBox keeps it round. */}
      <div
        aria-hidden="true"
        className="absolute z-0 left-[84.5%] top-[23.3%] -translate-x-1/2 -translate-y-1/2 w-[6.8vw] h-[6.8vw] rounded-full bg-gold opacity-[0.85]"
      />
      <div className="relative z-10 max-w-[980px] mx-auto px-6">
        <p className="font-mono text-xs tracking-[0.14em] text-gold uppercase mb-3.5">
          An early interest check — nothing&rsquo;s booked yet
        </p>
        <h1 className="text-snow text-3xl sm:text-[40px] leading-[1.15] max-w-[14ch]">
          Colorado ski weekend, late winter 2027
        </h1>
        <p className="text-[#CFE0D5] text-base max-w-[52ch] mt-3.5">
          Megan and I already have the Ikon Base Pass, so we&rsquo;re looking at a
          trip built around resorts that pass already covers — everyone else
          can grab a short Ikon Session Pass for just the days they&rsquo;ll ski.
          This page is here to get a read on who&rsquo;s actually interested and
          which dates could work, nothing&rsquo;s locked in yet.
        </p>
        <div className="flex gap-7 mt-8 flex-wrap">
          <div>
            <div className="font-mono text-xl text-gold">3</div>
            <div className="text-xs text-[#AEC4B7] mt-0.5">towns to choose from</div>
          </div>
          <div>
            <div className="font-mono text-xl text-gold">Jan–Mar</div>
            <div className="text-xs text-[#AEC4B7] mt-0.5">rough planning window</div>
          </div>
        </div>
      </div>
    </header>
  );
}
