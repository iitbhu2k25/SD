'use client';
import { useEffect, useRef } from "react";
import { Twitter, Youtube, Linkedin } from "lucide-react";

declare global {
  interface Window {
    twttr: any;
  }
}

const socialItems = [
  {
    type: "twitter-post",
    profileName: "JalTattva",
    tweetId: "1853469371840238068",
    title: "Twitter",
    icon: <Twitter className="w-8 h-8 text-blue-400 mx-auto mt-2" />,
  },
  {
    type: "youtube",
    videoId: "KY57d0zNkoM",
    articleUrl:
      "https://www.slcrvaranasi.com/post/innovative-effort-to-rejuvenate-small-rivers-with-smart-laboratory-at-iit-bhu",
    title: "YouTube",
    icon: <Youtube className="w-8 h-8 text-red-600 mx-auto mt-2" />,
  },
  {
    type: "linkedin",
    profileUrl:
      "linkedin.com/in/slcr-smart-laboratory-on-clean-rivers-b65a4134a",
    title: "LinkedIn",
    icon: <Linkedin className="w-8 h-8 text-blue-700 mx-auto mt-2" />,
  },
  {
    type: "instagram",
    title: "Instagram",
  },
];

export default function SocialGridSection() {
  const twitterScriptRef = useRef<HTMLScriptElement | null>(null);
  const linkedinScriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!twitterScriptRef.current) {
      const script = document.createElement("script");
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.charset = "utf-8";
      document.body.appendChild(script);
      twitterScriptRef.current = script;

      script.onload = () => {
        if (window.twttr && window.twttr.widgets) {
          window.twttr.widgets.load();
        }
      };
    } else {
      if (window.twttr && window.twttr.widgets) {
        window.twttr.widgets.load();
      }
    }

    if (!linkedinScriptRef.current) {
      const script = document.createElement("script");
      script.src = "https://wdg.fouita.com/widgets/0x24d18b.js";
      script.async = true;
      document.body.appendChild(script);
      linkedinScriptRef.current = script;
    }

    const fouitaScript = document.createElement("script");
    fouitaScript.src = "https://wdg.fouita.com/widgets/0x24d083.js";
    fouitaScript.async = true;
    document.body.appendChild(fouitaScript);
  }, []);

  // Helper function to get gradient glow classes by type
  function getGradientGlow(type: string) {
    switch (type) {
      case "twitter-post":
        return "before:bg-gradient-to-r before:from-blue-700/70 before:via-blue-400/40 before:to-blue-700/70";
      case "youtube":
        return "before:bg-gradient-to-r before:from-red-900/70 before:via-red-600/40 before:to-red-900/70";
      case "linkedin":
        return "before:bg-gradient-to-r before:from-blue-900/70 before:via-blue-700/40 before:to-blue-900/70";
      case "instagram":
        return "before:bg-gradient-to-r before:from-pink-700/70 before:via-purple-600/40 before:to-yellow-400/70";
      default:
        return "before:bg-gradient-to-r before:from-gray-700/70 before:via-gray-400/40 before:to-gray-700/70";
    }
  }

  return (
    <section className="py-10 flex justify-center items-center max-w-[80%] mx-auto">
      <div className="w-full">
        <h2 className="text-3xl font-bold text-center mb-8">Connect With Us</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
          {socialItems.map((item, index) => (
            <div
              key={index}
              className={
                "relative group bg-white rounded-xl shadow-lg text-center p-4 overflow-hidden " +
                "transform transition-all duration-300 ease-in-out hover:scale-[1.05] hover:shadow-2xl hover:z-10 h-[300px] " +
                "before:absolute before:inset-0 before:rounded-xl before:blur-lg before:z-[-1] before:opacity-70 " +
                getGradientGlow(item.type)
              }
            >
              {item.type === "twitter-post" && (
                <div className="w-full h-full overflow-auto">
                  <blockquote className="twitter-tweet" data-media-max-width="560">
                    <p lang="en" dir="ltr">
                      Team SLCR (IIT-BHU) participated in Ganga Utsav 2024 showcasing the joint vision of clean rivers.
                      <a href="https://t.co/8XaF5A4cfW">pic.twitter.com/8XaF5A4cfW</a>
                    </p>
                    &mdash; Smart Laboratory For Clean Rivers (@JalTattva){" "}
                    <a href="https://twitter.com/JalTattva/status/1853469371840238068">
                      Nov 4, 2024
                    </a>
                  </blockquote>
                </div>
              )}

              {item.type === "youtube" && (
                <div className="w-full h-full flex flex-col justify-between">
                  <iframe
                    width="100%"
                    height="260"
                    src={`https://www.youtube.com/embed/${item.videoId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  ></iframe>
                  <a
                    href={item.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm underline mt-2"
                  >
                    Read our article
                  </a>
                </div>
              )}

              {item.type === "linkedin" && (
                <div className="w-full h-full overflow-auto">
                  <div data-key="LinkedIn Full Profile" className="ft" id="ftgsqprtx"></div>
                </div>
              )}

              {item.type === "instagram" && (
                <div className="w-full h-full overflow-auto">
                  <div data-key="Masonry Instagram Feed" className="ft" id="ft2nd5422k"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}