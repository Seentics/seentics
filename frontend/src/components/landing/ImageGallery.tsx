"use client";

import Image from "next/image";
import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

type GalleryItem = {
  title: string;
  description?: string;
  src: string;
  width?: number;
  height?: number;
};

type ImageGalleryProps = {
  items?: GalleryItem[];
};

const defaultItems: GalleryItem[] = [
  {
    title: "Dashboard",
    description: "Overview of traffic, conversions, and insights",
    src: "https://placehold.co/1200x800/png?text=Seentics+Dashboard",
    width: 1200,
    height: 800,
  },
  {
    title: "Workflow Builder",
    description: "Visual editor with triggers, conditions, and actions",
    src: "https://placehold.co/1200x800/png?text=Workflow+Builder",
    width: 1200,
    height: 800,
  },
  {
    title: "Analytics",
    description: "Detailed metrics, trends, and performance",
    src: "https://placehold.co/1200x800/png?text=Analytics+Reports",
    width: 1200,
    height: 800,
  },
  {
    title: "Realtime",
    description: "Live users and events streaming in",
    src: "https://placehold.co/1200x800/png?text=Realtime+Activity",
    width: 1200,
    height: 800,
  },
];

export default function ImageGallery({ items = defaultItems }: ImageGalleryProps) {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [lightboxOpen, setLightboxOpen] = React.useState(false)

  React.useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrentIndex(api.selectedScrollSnap())
    onSelect()
    api.on("select", onSelect)
    api.on("reInit", onSelect)
    return () => {
      api.off("select", onSelect)
      api.off("reInit", onSelect)
    }
  }, [api])

  const openLightboxAt = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const goPrev = () => {
    if (!api) return
    api.scrollPrev()
  }

  const goNext = () => {
    if (!api) return
    api.scrollNext()
  }

  const scrollTo = (index: number) => {
    api?.scrollTo(index)
  }

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-6 text-slate-900 dark:text-white">
            See Seentics in Action
          </h2>
          <p className="text-lg md:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto px-4">
            Explore our intuitive interface and powerful features that make automation simple
          </p>
        </div>
        
        {/* Carousel */}
        <div className="max-w-6xl mx-auto mb-12 md:mb-16">
          <Carousel
            setApi={setApi}
            className="w-full"
            opts={{
              align: "start",
              loop: true,
            }}
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {items.map((item, index) => (
                <CarouselItem key={index} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                  <div className="group cursor-pointer" onClick={() => openLightboxAt(index)}>
                    <div className="relative overflow-hidden rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                      <Image
                        src={item.src}
                        alt={item.title}
                        width={item.width || 1200}
                        height={item.height || 800}
                        className="w-full h-64 md:h-80 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <h3 className="text-lg md:text-xl font-semibold mb-2">{item.title}</h3>
                        {item.description && (
                          <p className="text-sm md:text-base text-slate-200">{item.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2 md:left-4" />
            <CarouselNext className="right-2 md:right-4" />
          </Carousel>
        </div>

        {/* Navigation Dots */}
        <div className="flex justify-center items-center gap-2 mb-8">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-300",
                currentIndex === index
                  ? "bg-slate-900 dark:bg-white scale-125"
                  : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
              )}
            />
          ))}
        </div>

        {/* Navigation Arrows */}
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={goPrev}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm md:text-base">Previous</span>
          </button>
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
          >
            <span className="text-sm md:text-base">Next</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-7xl p-0 bg-transparent border-0">
          <div className="relative">
            <Image
              src={items[currentIndex]?.src || ""}
              alt={items[currentIndex]?.title || ""}
              width={1200}
              height={800}
              className="w-full h-auto rounded"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded p-4 text-white">
              <h3 className="text-lg md:text-xl font-semibold mb-2">
                {items[currentIndex]?.title}
              </h3>
              {items[currentIndex]?.description && (
                <p className="text-sm md:text-base text-slate-200">
                  {items[currentIndex]?.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 md:w-10 md:h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors duration-200"
            >
              <span className="text-lg md:text-xl">×</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}


