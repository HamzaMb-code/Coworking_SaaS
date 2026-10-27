import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  Compass,
  CreditCard,
  DoorOpen,
  MapPin,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import PopularWorkspaces from "@/components/home/PopularWorkspaces";
import BackToTop from "@/components/home/BackToTop";
import HomeNavbar from "@/components/home/HomeNavbar";

const teamImage = "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1400&q=85";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f1f2ef] text-[#172441]">
      <HomeNavbar />

      <section id="home" className="relative isolate min-h-[760px] overflow-hidden bg-[#102d34] bg-cover bg-center pt-28 text-white lg:min-h-[850px]" style={{ backgroundImage: "linear-gradient(90deg, rgba(8,31,39,.76) 0%, rgba(8,31,39,.52) 50%, rgba(8,31,39,.3) 100%), url('/images/heroImage.webp')" }}>
        <div className="pointer-events-none absolute inset-[4.5%] z-10 rounded-[34px] border border-white/40" />
        <div className="mx-auto grid min-h-[650px] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-white/80"><span className="h-px w-8 bg-white/80" />Find your perfect space</p>
            <h1 className="mt-6 text-5xl font-medium leading-[1.02] tracking-[-.045em] sm:text-6xl lg:text-[76px]">Flexible workspaces for a <span className="text-white/60">bigger tomorrow.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">Discover and book inspiring coworking spaces, private offices, and meeting rooms. Find the right place for focused work, great ideas, and your next step forward.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/discover" className="inline-flex h-13 items-center gap-3 rounded-xl bg-white px-6 text-sm font-semibold text-[#153b3a] transition hover:-translate-y-0.5 hover:bg-white/85">Explore workspaces <ArrowRight className="size-4" /></Link><Link href="#how-it-works" className="inline-flex h-13 items-center gap-2 rounded-xl border border-white/35 bg-black/15 px-6 text-sm font-semibold text-white backdrop-blur hover:bg-black/25">How it works <Compass className="size-4" /></Link></div>
            <div className="mt-12 grid max-w-xl grid-cols-2 gap-x-5 gap-y-6 border-t border-white/25 pt-7 sm:grid-cols-4"><Benefit icon={<Zap />} title="Easy booking" caption="A few simple steps" /><Benefit icon={<ShieldCheck />} title="Clear pricing" caption="Know before you book" /><Benefit icon={<MapPin />} title="Great locations" caption="Find a space nearby" /><Benefit icon={<Users />} title="Better together" caption="Room to connect" /></div>
          </div>
          <div className="relative hidden h-[520px] lg:block">
            <div className="absolute right-2 top-7 w-60 rounded-2xl border border-white/20 bg-[#10282e]/55 p-5 text-white shadow-xl backdrop-blur-md"><p className="text-3xl font-bold">One place</p><p className="mt-1 text-sm text-white/70">For your next great workday</p></div>
            <div className="absolute bottom-12 left-0 max-w-[260px] rounded-2xl border border-white/20 bg-[#10282e]/55 p-5 text-white shadow-xl backdrop-blur-md"><span className="grid size-10 place-items-center rounded-xl bg-white/15 text-white"><CalendarCheck className="size-5" /></span><p className="mt-4 font-semibold">Your workday, your way</p><p className="mt-1 text-sm leading-6 text-white/75">Book a desk for an hour or settle into a space that feels like yours.</p></div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 rounded-t-[50%] bg-[#f1f2ef]" />
      </section>

      <section aria-labelledby="explore-title" className="mx-auto max-w-7xl px-5 pt-12 sm:px-8 sm:pt-16">
        <div className="relative overflow-hidden rounded-[28px] border border-[#d7e6dc] bg-[#eaf3ed] p-5 shadow-xl shadow-[#153d2b]/[.06] sm:p-8">
          <div className="relative z-10">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Find your place</p><h2 id="explore-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Explore workspaces</h2><p className="mt-2 text-sm text-[#687591]">A few details help us find a space that works for you.</p></div></div>
          <form action="/discover" method="get" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="sr-only" htmlFor="home-city">City</label><input id="home-city" name="city" placeholder="City" className="h-12 min-w-0 rounded-xl border border-[#dfe6df] bg-[#fbfcfa] px-4 text-sm outline-none transition focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" />
            <label className="sr-only" htmlFor="home-type">Workspace type</label><select id="home-type" name="resource_type" defaultValue="" className="h-12 min-w-0 rounded-xl border border-[#dfe6df] bg-[#fbfcfa] px-4 text-sm outline-none transition focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10"><option value="">Any workspace type</option><option value="coworking">Coworking spaces</option><option value="private_office">Private offices</option><option value="meeting_room">Meeting rooms</option><option value="hot_desk">Hot desks</option><option value="event_space">Event spaces</option></select>
            <label className="sr-only" htmlFor="home-date">Date</label><input id="home-date" name="date" type="date" className="h-12 min-w-0 rounded-xl border border-[#dfe6df] bg-[#fbfcfa] px-4 text-sm outline-none transition focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" />
            <label className="sr-only" htmlFor="home-price">Maximum price</label><input id="home-price" name="price" type="number" min="0" placeholder="Max price (MAD)" className="h-12 min-w-0 rounded-xl border border-[#dfe6df] bg-[#fbfcfa] px-4 text-sm outline-none transition focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" />
            <label className="sr-only" htmlFor="home-capacity">Capacity</label><input id="home-capacity" name="capacity" type="number" min="1" placeholder="People" className="h-12 min-w-0 rounded-xl border border-[#dfe6df] bg-[#fbfcfa] px-4 text-sm outline-none transition focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" />
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-5 text-sm font-semibold text-white shadow-lg shadow-[#176b4d]/15 transition hover:-translate-y-0.5 hover:bg-[#125a40]"><Search className="size-4" />Explore Workspaces</button>
          </form>
          </div>
        </div>
      </section>        

      <section aria-labelledby="popular-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Made for good work</p><h2 id="popular-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Popular workspaces</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#687591]">Discover welcoming places to focus, meet, and make progress.</p></div><Link href="/discover" className="inline-flex items-center gap-2 text-sm font-semibold text-[#176b4d]">View all workspaces <ArrowRight className="size-4" /></Link></div>
        <PopularWorkspaces />
      </section>

      <section id="about" className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:py-28">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-[#176b4d]"><span className="h-px w-8 bg-[#176b4d]" />About us</p>
          <h2 className="mt-5 max-w-xl text-4xl font-bold leading-tight tracking-[-.035em] sm:text-5xl">Building better workspaces, <span className="text-[#176b4d]">together.</span></h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#687591]">Good work can happen anywhere, when the space is right. WorkSpace brings welcoming places and the people who run them together, making it simpler to find a desk, host a team, or grow a workspace business.</p>
          <div className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2"><AboutPoint icon={<Users />} title="For people" copy="Find a space that fits your day, your team, and the way you work." /><AboutPoint icon={<Building2 />} title="For workspace owners" copy="Showcase your spaces, manage availability, and keep every booking in view." /><AboutPoint icon={<ShieldCheck />} title="For productive teams" copy="Choose places designed for focus, collaboration, and good ideas." /><AboutPoint icon={<ArrowRight />} title="For what’s next" copy="Help build a more connected and flexible way to work." /></div>
          <p className="mt-9 text-lg font-semibold italic text-[#176b4d]">More than a place to work.</p>
        </div>
        <div className="relative mx-auto w-full max-w-2xl pb-8 pl-6 pr-5 pt-6 sm:pl-12 sm:pr-8">
          <span className="absolute left-16 top-0 size-24 rounded-full bg-emerald-100" /><span className="absolute bottom-0 right-16 size-24 rounded-full bg-[#176b4d]" />
          <div className="relative h-[440px] overflow-hidden rounded-[28px] shadow-2xl shadow-emerald-100 sm:h-[530px]"><Image src={teamImage} alt="A bright collaborative workspace ready for teams" fill sizes="(max-width: 1024px) 90vw, 50vw" className="object-cover" /></div>
          <div className="absolute left-0 top-14 rounded-2xl border border-white bg-white/95 p-4 shadow-xl sm:p-5"><p className="text-2xl font-bold text-[#176b4d]">Spaces</p><p className="text-sm text-[#687591]">for every kind of work</p></div>
          <div className="absolute bottom-0 right-0 max-w-[260px] rounded-2xl border border-emerald-100 bg-white/95 p-5 shadow-xl"><p className="flex items-center gap-2 font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-[#176b4d]"><Check className="size-5" /></span>Our mission</p><p className="mt-3 text-sm leading-6 text-[#687591]">Make it easier for everyone to find their place to focus, connect, and grow.</p></div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#f0f1ef] text-[#171d1b]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[.16em] text-[#176b4d]"><span className="font-bold text-[#4f78e8]">//</span>A simpler way to work</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">From search to seat, made simple.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#68716d] sm:text-base">Everything you need to book a space or run one, in one place.</p>
          </div>
          <div className="mt-10 grid border-t border-[#d5d8d5] md:mt-14 md:grid-cols-3">
            <Step icon={<SearchIcon />} number="1" title="Discover" description="Explore workspaces by city, space type, price, and the date you need." image="/images/howItWorks_discover.webp" imageAlt="Discover workspaces" />
            <Step icon={<CalendarCheck />} number="2" title="Choose" description="Compare spaces and select a resource, time, and pricing unit that suit your plans." image="/images/howItWorks_choose.webp" imageAlt="Choose a workspace" />
            <Step icon={<CreditCard />} number="3" title="Book & Pay" description="Send your booking request, follow its confirmation, and pay securely for your reservation." image="/images/howItWorks_bookAndPay.webp" imageAlt="Book and pay for a workspace" />
          </div>
        </div>
      </section>

      <section aria-labelledby="types-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Room for every kind of work</p><h2 id="types-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your kind of space</h2><p className="mt-3 leading-7 text-[#687591]">From a focused hour to a place for your whole team, find the setup that feels right.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SpaceType icon={<Users />} title="Coworking Spaces" description="A welcoming place to focus and connect." type="desk" image="/images/coworking_spaces.webp" /><SpaceType icon={<BriefcaseBusiness />} title="Private Offices" description="Your own room to build, plan, and grow." type="private_office" image="/images/private_offices.webp" /><SpaceType icon={<CalendarDays />} title="Meeting Rooms" description="A polished setting for your next conversation." type="meeting_room" image="/images/meeting_rooms.webp" /><SpaceType icon={<DoorOpen />} title="Hot Desks" description="A flexible seat ready when you are." type="desk" image="/images/hot_desks.webp" /></div></section>

      <section aria-labelledby="why-title" className="bg-white"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Better workdays start here</p><h2 id="why-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">A better way to find your space</h2></div><div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Feature icon={<CalendarCheck />} title="Flexible booking" description="Book by the hour, day, or month based on how each space is priced." /><Feature icon={<Compass />} title="Simple experience" description="Search, compare, and request a workspace in just a few clear steps." /><Feature icon={<Check />} title="Reliable availability" description="See active spaces and booking details before you plan your workday." /><Feature icon={<ShieldCheck />} title="Secure payments" description="Keep your reservation and payment details together in one place." /></div></div></section>

      <section aria-labelledby="cities-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Find a space nearby</p><h2 id="cities-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Explore by city</h2></div><p className="max-w-lg text-sm leading-6 text-[#687591]">Discover workspaces across Morocco’s most connected cities.</p></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ name: "Casablanca", sub: "A city that keeps ideas moving", image: "/images/Casablanca.webp" }, { name: "Rabat", sub: "Make room for focused work", image: "/images/rabat.webp" }, { name: "Marrakech", sub: "A fresh setting for new ideas", image: "/images/marrakech.webp" }, { name: "Tangier", sub: "Find your next view", image: "/images/tangier.webp" }].map((city) => <Link key={city.name} href={`/discover?city=${encodeURIComponent(city.name)}`} className="group relative isolate flex min-h-48 flex-col justify-end overflow-hidden rounded-2xl bg-[#153b37] p-5 text-white shadow-sm"><Image src={city.image} alt={`${city.name} city`} fill sizes="(max-width: 768px) 100vw, 25vw" className="-z-20 object-cover transition duration-500 group-hover:scale-105" /><span className="absolute inset-0 -z-10 bg-gradient-to-t from-[#102e2c]/90 via-[#102e2c]/20 to-transparent" /><span className="text-xl font-semibold">{city.name}</span><span className="mt-1 text-sm text-white/75">{city.sub}</span><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">Explore spaces <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></Link>)}</div></section>

      <section aria-labelledby="owners-title" className="mx-5 overflow-hidden rounded-[28px] bg-[#153b37] text-white shadow-xl shadow-[#153b37]/10 sm:mx-8"><div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.2fr_.8fr] lg:py-14"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/60">For workspace owners</p><h2 id="owners-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Make your space work harder.</h2><p className="mt-4 max-w-2xl leading-7 text-white/75">List your coworking space, showcase its resources, manage availability, and receive booking requests from people looking for a better place to work.</p><Link href="/owner/workspaces" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#153b37] transition hover:bg-[#edf3ee]">List Your Workspace <ArrowRight className="size-4" /></Link></div><div className="grid grid-cols-2 gap-3">{[{ icon: <Building2 />, text: "Showcase your spaces" }, { icon: <CalendarCheck />, text: "Manage bookings" }, { icon: <Users />, text: "Welcome your members" }, { icon: <CreditCard />, text: "Track your payments" }].map((item) => <div key={item.text} className="rounded-2xl border border-white/15 bg-white/[.07] p-4 backdrop-blur"><span className="grid size-9 place-items-center rounded-xl bg-white/10 text-white">{item.icon}</span><p className="mt-4 text-sm font-medium">{item.text}</p></div>)}</div></div></section>

      <footer className="mt-16 rounded-t-[36px] bg-[#f4f6f3] px-3 pb-3 pt-3 sm:mt-20 sm:px-5 sm:pt-5">
        <section className="relative isolate overflow-hidden rounded-[30px] bg-[#102e2c] px-5 py-16 text-center text-white sm:py-20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(67,132,103,.48),transparent_62%)]" />
          <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-100/75">Make your next day count</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your next workspace is waiting.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Find a place to focus, meet, and move your work forward.</p>
          <Link href="/discover" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#153b37] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#edf3ee]">Explore Workspaces <ArrowRight className="size-4" /></Link>
        </section>
        <div className="relative isolate overflow-hidden rounded-[30px] bg-white px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 left-5 -z-10 select-none text-[clamp(8rem,24vw,20rem)] font-bold leading-none tracking-[-.08em] text-[#f7f8f6]">WorkSpace</span>
          <div className="mx-auto max-w-7xl rounded-[26px] border border-[#e6eae6] bg-white/95 p-6 shadow-[0_18px_60px_rgba(21,59,55,.06)] backdrop-blur sm:p-8 lg:p-10">
            <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] lg:gap-16">
              <div>
                <Link href="/" className="inline-flex items-center gap-2.5 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#176b4d] text-white"><Building2 className="size-5" /></span><span className="text-lg">WorkSpace</span></Link>
                <p className="mt-4 max-w-md text-sm leading-6 text-[#687591]">A better place to get work done. Find a desk, book a meeting room, or discover a workspace for your team.</p>
              </div>
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                <div><h3 className="text-sm font-semibold">Explore</h3><ul className="mt-4 space-y-3 text-sm text-[#687591]"><li><Link href="/discover" className="transition hover:text-[#176b4d]">All workspaces</Link></li><li><Link href="#popular-title" className="transition hover:text-[#176b4d]">Popular spaces</Link></li><li><Link href="#cities-title" className="transition hover:text-[#176b4d]">Explore by city</Link></li></ul></div>
                <div><h3 className="text-sm font-semibold">WorkSpace</h3><ul className="mt-4 space-y-3 text-sm text-[#687591]"><li><Link href="#about" className="transition hover:text-[#176b4d]">About us</Link></li><li><Link href="#how-it-works" className="transition hover:text-[#176b4d]">How it works</Link></li><li><Link href="/login" className="transition hover:text-[#176b4d]">Sign in</Link></li></ul></div>
                <div><h3 className="text-sm font-semibold">For owners</h3><ul className="mt-4 space-y-3 text-sm text-[#687591]"><li><Link href="/owner/workspaces" className="transition hover:text-[#176b4d]">List your workspace</Link></li><li><Link href="/register" className="transition hover:text-[#176b4d]">Create an account</Link></li></ul></div>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-[#edf0ed] pt-5 text-xs text-[#89938d] sm:mt-10 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} WorkSpace. All rights reserved.</span><span>Find your place to focus, connect, and grow.</span></div>
          </div>
        </div>
      </footer>
      <BackToTop />
    </main>
  );
}

function Benefit({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) { return <div><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]">{icon}</span><p className="mt-2 text-xs font-semibold sm:text-sm">{title}</p><p className="mt-1 text-xs text-[#77829a]">{caption}</p></div>; }
function AboutPoint({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]">{icon}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#687591]">{copy}</p></div>; }
function Step({ icon, number, title, description, image, imageAlt }: { icon: React.ReactNode; number: string; title: string; description: string; image: string; imageAlt: string }) { return <article className={`group py-6 md:px-6 md:py-7 lg:px-8 ${number !== "1" ? "border-t border-[#d5d8d5] md:border-l md:border-t-0" : ""}`}><div className="relative aspect-[1.6] overflow-hidden rounded-xl bg-[#dfe5df] shadow-sm"><Image src={image} alt={imageAlt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" /><span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" /><span className="absolute bottom-3 left-3 grid size-10 place-items-center rounded-xl border border-white/50 bg-white/90 text-[#176b4d] shadow-sm backdrop-blur">{icon}</span></div><span className="mt-5 inline-flex rounded-md bg-[#c5f568] px-3 py-1.5 text-xs font-bold text-[#203326]">Step {number}</span><h3 className="mt-3 text-lg font-semibold tracking-tight sm:text-xl">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#68716d]">{description}</p></article>; }
function SpaceType({ icon, title, description, type, image }: { icon: React.ReactNode; title: string; description: string; type: string; image: string }) { return <Link href={`/discover?resource_type=${encodeURIComponent(type)}`} className="group overflow-hidden rounded-xl border border-[#e1e8e2] bg-white transition duration-200 hover:border-[#b8d0be] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] focus-visible:ring-offset-2"><div className="relative aspect-[1.65] overflow-hidden bg-[#e8ede8]"><Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.02]" /><span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#102e2c]/40 to-transparent" /><span className="absolute bottom-4 left-4 grid size-11 place-items-center rounded-xl bg-white/95 text-[#176b4d] backdrop-blur transition group-hover:bg-[#176b4d] group-hover:text-white">{icon}</span></div><div className="p-4 sm:p-5"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#687591]">{description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#176b4d]">Explore type <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></div></Link>; }
function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) { return <article className="rounded-xl border border-[#e8ede8] bg-[#fbfcfa] p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]">{icon}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#687591]">{description}</p></article>; }
function SearchIcon() { return <Compass className="size-5" />; }
