/** The plain statement under the hero: the products are separate, and bundling is optional. */
export default function SuiteIntro() {
  return (
    <section className="px-4 pb-4 pt-16 text-center md:pt-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Buy one. Or all three.
        </h2>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Analytics, Observability and Uptime each work on their own. Pay only for the ones you use, or take the Suite plan
          and get all three for less.
        </p>
      </div>
    </section>
  );
}
