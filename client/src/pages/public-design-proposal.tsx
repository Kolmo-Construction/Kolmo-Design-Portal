import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DesignProposalWithComparisons } from "@shared/schema";
import { X } from "lucide-react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { 
  Phone, 
  Mail, 
  Shield, 
  Award, 
  Star, 
  Paintbrush,
  ArrowLeftRight,
  Check,
  Sparkles,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import kolmoLogo from "@assets/kolmo-logo (1).png";

export default function PublicDesignProposalPage() {
  const [, params] = useRoute("/design-proposal/:token");
  const token = params?.token;

  const { data: proposal, isLoading, error } =
    useQuery<DesignProposalWithComparisons>({
      queryKey: [`/api/design-proposals/public/${token}`],
      enabled: !!token,
    });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#f5f5f5'}}>
        <Card className="max-w-md shadow-xl">
          <CardHeader>
            <CardTitle style={{color: '#3d4552'}}>Invalid Link</CardTitle>
            <CardDescription>
              The design proposal link is invalid or missing.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{backgroundColor: '#f5f5f5'}}>
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="space-y-8">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#f5f5f5'}}>
        <Card className="max-w-md shadow-xl">
          <CardHeader>
            <CardTitle style={{color: '#3d4552'}}>Proposal Not Found</CardTitle>
            <CardDescription>
              The design proposal you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{backgroundColor: '#f5f5f5'}}>
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2">
                  <img src={kolmoLogo} alt="Kolmo Construction" className="h-8 w-8 sm:h-12 sm:w-12 object-contain" data-testid="img-kolmo-logo" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold" style={{color: '#3d4552'}}>Kolmo Construction</h1>
                  <div className="hidden sm:flex flex-wrap items-center gap-2 lg:gap-4 text-xs sm:text-sm mt-1" style={{color: '#4a6670'}}>
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3 sm:h-4 sm:w-4" style={{color: '#db973c'}} />
                      <span>Licensed & Insured</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="h-3 w-3 sm:h-4 sm:w-4" style={{color: '#db973c'}} />
                      <span>EPA Certified</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-1">
                      <Star className="h-3 w-3 sm:h-4 sm:w-4" style={{color: '#db973c'}} />
                      <span>Seattle's Premier Builder</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1.5 sm:gap-2 text-sm">
                <a 
                  href="tel:+12064105100" 
                  className="flex items-center gap-1.5 sm:gap-2 transition-colors" 
                  style={{color: '#4a6670'}} 
                  onMouseEnter={e => e.currentTarget.style.color = '#db973c'} 
                  onMouseLeave={e => e.currentTarget.style.color = '#4a6670'}
                  data-testid="link-phone"
                >
                  <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="font-semibold text-xs sm:text-sm">(206) 410-5100</span>
                </a>
                <a 
                  href="mailto:projects@kolmo.io" 
                  className="flex items-center gap-1.5 sm:gap-2 transition-colors" 
                  style={{color: '#4a6670'}} 
                  onMouseEnter={e => e.currentTarget.style.color = '#db973c'} 
                  onMouseLeave={e => e.currentTarget.style.color = '#4a6670'}
                  data-testid="link-email"
                >
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">projects@kolmo.io</span>
                </a>
              </div>
            </div>
            {/* Mobile Contact Buttons */}
            <div className="flex sm:hidden gap-2">
              <a 
                href="tel:+12064105100" 
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all"
                style={{backgroundColor: '#db973c', color: 'white'}}
                data-testid="button-mobile-phone"
              >
                <Phone className="h-4 w-4" />
                <span>Call</span>
              </a>
              <a 
                href="mailto:projects@kolmo.io" 
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all border"
                style={{backgroundColor: 'white', color: '#4a6670', borderColor: '#4a6670'}}
                data-testid="button-mobile-email"
              >
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-white py-8 sm:py-12 lg:py-16" style={{backgroundColor: '#3d4552'}}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-4 sm:mb-6" style={{backgroundColor: 'rgba(219, 151, 60, 0.15)'}}>
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" style={{color: '#db973c'}} />
            <span className="text-xs sm:text-sm font-medium" style={{color: '#db973c'}}>Your Design Proposal</span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2 animate-fadeIn" data-testid="text-proposal-title">
            {proposal.title}
          </h1>
          
          {proposal.description && (
            <p className="text-base sm:text-lg lg:text-xl text-white/80 max-w-3xl mx-auto mb-4 sm:mb-6 px-4 animate-fadeIn animation-delay-200" data-testid="text-proposal-description">
              {proposal.description}
            </p>
          )}
          
          {proposal.customerName && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg animate-fadeIn animation-delay-300" style={{backgroundColor: 'rgba(255, 255, 255, 0.1)'}}>
              <Paintbrush className="h-4 w-4 sm:h-5 sm:w-5" style={{color: '#db973c'}} />
              <span className="font-medium text-sm sm:text-base" data-testid="text-customer-name">
                Prepared for {proposal.customerName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-8 sm:py-12">
        {proposal.comparisons && proposal.comparisons.length > 0 ? (
          <div className="space-y-8 sm:space-y-12">
            {/* Section Header */}
            <div className="text-center mb-4 sm:mb-8">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-3 sm:mb-4" style={{backgroundColor: 'rgba(219, 151, 60, 0.1)'}}>
                <ArrowLeftRight className="h-4 w-4 sm:h-5 sm:w-5" style={{color: '#db973c'}} />
                <span className="text-xs sm:text-sm font-medium" style={{color: '#db973c'}}>
                  Before & After Transformations
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold px-2" style={{color: '#3d4552'}}>
                See the Difference
              </h2>
              <p className="text-base sm:text-lg mt-2 px-4" style={{color: '#4a6670'}}>
                Drag the slider to compare our proposed design changes
              </p>
            </div>

            {/* Comparison Cards */}
            {proposal.comparisons.map((comparison, index) => (
              <div 
                key={comparison.id} 
                className="animate-fadeIn" 
                style={{animationDelay: `${index * 100}ms`, animationFillMode: 'both'}}
                data-testid={`card-comparison-${index}`}
              >
                <Card className="overflow-hidden shadow-lg border sm:border-2 hover:shadow-xl transition-shadow" style={{borderColor: '#e5e5e5'}}>
                  <CardHeader className="bg-white p-4 sm:p-6" style={{borderBottom: '2px solid #f5f5f5'}}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg sm:text-xl lg:text-2xl mb-1 sm:mb-2" style={{color: '#3d4552'}} data-testid={`text-comparison-title-${index}`}>
                          {comparison.title}
                        </CardTitle>
                        {comparison.description && (
                          <CardDescription className="text-sm sm:text-base" style={{color: '#4a6670'}} data-testid={`text-comparison-description-${index}`}>
                            {comparison.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge className="text-xs font-semibold shrink-0 self-start" style={{backgroundColor: '#db973c', color: 'white'}}>
                        #{index + 1}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative" style={{backgroundColor: '#f5f5f5'}}>
                      <ReactCompareSlider
                        itemOne={
                          <ReactCompareSliderImage
                            src={comparison.beforeImageUrl}
                            alt="Before"
                            style={{ 
                              objectFit: 'cover',
                              objectPosition: 'center',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%', 
                              height: '100%',
                              maxHeight: 'none',
                              display: 'block'
                            }}
                          />
                        }
                        itemTwo={
                          <ReactCompareSliderImage
                            src={comparison.afterImageUrl}
                            alt="After"
                            style={{ 
                              objectFit: 'cover',
                              objectPosition: 'center',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%', 
                              height: '100%',
                              maxHeight: 'none',
                              display: 'block'
                            }}
                          />
                        }
                        position={50}
                        style={{
                          height: window.innerWidth < 640 ? "300px" : window.innerWidth < 1024 ? "450px" : "600px",
                          width: "100%",
                          position: 'relative'
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center px-3 sm:px-6 py-3 sm:py-4 bg-white" style={{borderTop: '2px solid #f5f5f5'}}>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{backgroundColor: '#4a6670'}}></div>
                        <span className="text-xs sm:text-sm font-semibold" style={{color: '#3d4552'}}>BEFORE</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 text-sm" style={{color: '#4a6670'}}>
                        <ArrowLeftRight className="h-4 w-4" />
                        <span>Drag to compare</span>
                      </div>
                      <div className="flex sm:hidden items-center gap-1 text-xs" style={{color: '#4a6670'}}>
                        <ArrowLeftRight className="h-3 w-3" />
                        <span>Drag</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm font-semibold" style={{color: '#3d4552'}}>AFTER</span>
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{backgroundColor: '#db973c'}}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <Paintbrush className="h-16 w-16 mx-auto mb-4" style={{color: '#4a6670', opacity: 0.5}} />
              <p className="text-lg" style={{color: '#4a6670'}}>
                No design comparisons available at this time.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pros and Cons Section */}
        {proposal.showProsCons && (proposal.pros?.length || proposal.cons?.length) && (
          <div className="mt-8 sm:mt-12">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold" style={{color: '#3d4552'}}>
                Design Analysis
              </h2>
              <p className="text-base sm:text-lg mt-2" style={{color: '#4a6670'}}>
                Considerations for this design proposal
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Pros Card */}
              {proposal.pros && proposal.pros.length > 0 && (
                <Card className="shadow-lg border-2 overflow-hidden" style={{borderColor: '#e5e5e5'}}>
                  <CardHeader className="bg-green-50 border-b-2" style={{borderColor: '#f5f5f5'}}>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-green-100">
                        <ThumbsUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                      </div>
                      <CardTitle className="text-xl sm:text-2xl text-green-700">
                        Advantages
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <ul className="space-y-3">
                      {proposal.pros.map((pro, index) => (
                        <li key={index} className="flex gap-3 items-start" data-testid={`pros-item-${index}`}>
                          <Check className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
                          <span className="text-sm sm:text-base" style={{color: '#3d4552'}}>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Cons Card */}
              {proposal.cons && proposal.cons.length > 0 && (
                <Card className="shadow-lg border-2 overflow-hidden" style={{borderColor: '#e5e5e5'}}>
                  <CardHeader className="bg-red-50 border-b-2" style={{borderColor: '#f5f5f5'}}>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-red-100">
                        <ThumbsDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                      </div>
                      <CardTitle className="text-xl sm:text-2xl text-red-700">
                        Considerations
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <ul className="space-y-3">
                      {proposal.cons.map((con, index) => (
                        <li key={index} className="flex gap-3 items-start" data-testid={`cons-item-${index}`}>
                          <X className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                          <span className="text-sm sm:text-base" style={{color: '#3d4552'}}>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="rounded-xl sm:rounded-2xl shadow-lg text-white p-6 sm:p-8 mt-8 sm:mt-12" style={{backgroundColor: '#4a6670'}}>
          <div className="text-center">
            <Check className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4" style={{color: '#db973c'}} />
            <h3 className="text-xl sm:text-2xl font-bold mb-2 px-2">Ready to Transform Your Space?</h3>
            <p className="text-sm sm:text-base text-white/80 mb-4 sm:mb-6 max-w-2xl mx-auto px-4">
              We're excited to bring your vision to life with our expert craftsmanship. 
              Contact us to discuss this proposal and next steps.
            </p>
            <Separator className="my-4 sm:my-6" style={{backgroundColor: 'rgba(255,255,255,0.2)'}} />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
              <a 
                href="tel:+12064105100" 
                className="flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-lg font-semibold transition-all hover:shadow-lg text-sm sm:text-base"
                style={{backgroundColor: '#db973c', color: 'white'}}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c8863a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#db973c'}
                data-testid="button-call"
              >
                <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Call Us: (206) 410-5100</span>
              </a>
              <a 
                href="mailto:projects@kolmo.io" 
                className="flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-lg font-semibold transition-all border-2 text-sm sm:text-base"
                style={{backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', borderColor: 'rgba(255,255,255,0.3)'}}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                data-testid="button-email"
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Email Us</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Footer */}
      <div className="text-white mt-8 sm:mt-12" style={{backgroundColor: '#3d4552'}}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="rounded-lg p-2 sm:p-3" style={{backgroundColor: '#4a6670'}}>
                <img src={kolmoLogo} alt="Kolmo Construction" className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-bold">Kolmo Construction</h3>
                <p className="text-sm sm:text-base" style={{color: 'rgba(255,255,255,0.7)'}}>Building Excellence Since 2010</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 mb-6 sm:mb-8">
              <div className="flex items-center justify-center gap-2 sm:gap-3" style={{color: 'rgba(255,255,255,0.7)'}}>
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" style={{color: '#db973c'}} />
                <div className="text-left">
                  <div className="font-semibold text-white text-sm sm:text-base">Licensed & Insured</div>
                  <div className="text-xs sm:text-sm">WA State Contractor License</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3" style={{color: 'rgba(255,255,255,0.7)'}}>
                <Award className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" style={{color: '#db973c'}} />
                <div className="text-left">
                  <div className="font-semibold text-white text-sm sm:text-base">EPA Certified</div>
                  <div className="text-xs sm:text-sm">Lead-Safe Work Practices</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3" style={{color: 'rgba(255,255,255,0.7)'}}>
                <Star className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" style={{color: '#db973c'}} />
                <div className="text-left">
                  <div className="font-semibold text-white text-sm sm:text-base">Trusted Locally</div>
                  <div className="text-xs sm:text-sm">Pacific Northwest Experts</div>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4 sm:pt-6 px-4" style={{borderColor: '#4a6670'}}>
              <p className="text-xs sm:text-sm" style={{color: 'rgba(255,255,255,0.6)'}}>
                © 2024 Kolmo. All rights reserved. | 
                Professional home improvement services with over a decade of experience in the Pacific Northwest.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
