import { Devvit } from '@devvit/public-api';
import { MemeData, MemeValuation } from '../storage/memeRegistry';
import { updateMarketHistory } from '../storage/marketHistory';

// Create a new meme and initialize its market data
export const createMeme = Devvit.createServerFunction('createMeme', 
  async ({
    templateId,
    templateUrl,
    title,
    topText,
    bottomText,
    categories,
    initialSharePrice,
  }: {
    templateId: string;
    templateUrl: string;
    title: string;
    topText?: string;
    bottomText?: string;
    categories: string[];
    initialSharePrice: number;
  }, context): Promise<MemeData> => {
    const { reddit, redis, scheduler } = context;
    
    try {
      // Get current user
      const currentUser = await reddit.getCurrentUser();
      
      // Generate a unique ID for the meme
      const memeId = `meme_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Create the meme object
      const newMeme: MemeData = {
        id: memeId,
        creatorId: currentUser.id,
        creatorName: currentUser.username,
        createdAt: new Date().toISOString(),
        templateId,
        templateUrl,
        title,
        topText: topText || '',
        bottomText: bottomText || '',
        categories,
        initialSharePrice,
        currentSharePrice: initialSharePrice,
        totalShares: 1000, // Initial share offering
        availableShares: 1000,
        tradeVolume: 0,
        priceHistory: [
          {
            timestamp: new Date().toISOString(),
            price: initialSharePrice
          }
        ],
        engagementScore: 10, // Initial engagement score
        lastUpdated: new Date().toISOString()
      };
      
      // Store the meme data in Redis
      await redis.set(`memes:${memeId}`, JSON.stringify(newMeme));
      
      // Add to the meme index
      const memeIndex = await redis.get('meme_index') || '[]';
      const memeIds = JSON.parse(memeIndex);
      memeIds.push(memeId);
      await redis.set('meme_index', JSON.stringify(memeIds));
      
      // Add to category indexes
      for (const category of categories) {
        const categoryIndex = await redis.get(`category:${category}`) || '[]';
        const categoryMemes = JSON.parse(categoryIndex);
        categoryMemes.push(memeId);
        await redis.set(`category:${category}`, JSON.stringify(categoryMemes));
      }
      
      // Give the creator initial shares
      const creatorPortfolio = await redis.get(`portfolio:${currentUser.id}`) || '{}';
      const portfolio = JSON.parse(creatorPortfolio);
      portfolio[memeId] = {
        shares: 100, // Creator gets 10% of initial shares
        averageBuyPrice: 0 // Free for creator
      };
      
      // Update available shares
      newMeme.availableShares -= 100;
      await redis.set(`memes:${memeId}`, JSON.stringify(newMeme));
      
      // Save creator's portfolio
      await redis.set(`portfolio:${currentUser.id}`, JSON.stringify(portfolio));
      
      // Schedule initial valuation update after 1 hour
      await scheduler.runAfter(3600, 'updateMemeValuation', { memeId });
      
      // Return the created meme
      return newMeme;
    } catch (error) {
      console.error('Error creating meme:', error);
      throw error;
    }
  });

// Calculate meme valuation based on engagement metrics
export const calculateMemeValue = Devvit.createServerFunction('calculateMemeValue',
  async ({ memeId }: { memeId: string }, context): Promise<MemeValuation> => {
    const { redis, reddit } = context;
    
    try {
      // Get meme data
      const memeJson = await redis.get(`memes:${memeId}`);
      if (!memeJson) {
        throw new Error(`Meme not found: ${memeId}`);
      }
      
      const meme: MemeData = JSON.parse(memeJson);
      
      // In a real implementation, we would fetch actual engagement data
      // For the hackathon, we'll simulate engagement metrics
      
      // Get post data if this meme has an associated post
      let engagementScore = meme.engagementScore || 10;
      let postKarma = 0;
      let commentCount = 0;
      
      if (meme.postId) {
        try {
          const post = await reddit.getPostById(meme.postId);
          postKarma = post.score;
          commentCount = post.commentCount;
          
          // Calculate engagement based on karma and comments
          // This is a simplified model - you could make this more sophisticated
          engagementScore = Math.max(
            10,
            postKarma * 0.5 + commentCount * 2 + meme.tradeVolume * 3
          );
        } catch (error) {
          console.error(`Error fetching post for meme ${memeId}:`, error);
          // Continue with existing engagement score if post fetch fails
        }
      }
      
      // Calculate new price based on engagement score and trade volume
      // This is a simplified algorithm - you would want to tune this
      // based on testing with real user data
      const priceChangePercent = calculatePriceChange(meme, engagementScore);
      const newPrice = Math.max(
        0.1, // Minimum price
        meme.currentSharePrice * (1 + priceChangePercent)
      );
      
      // Market cap = total shares * price
      const marketCap = meme.totalShares * newPrice;
      
      return {
        memeId,
        previousPrice: meme.currentSharePrice,
        currentPrice: newPrice,
        priceChangePercent,
        marketCap,
        engagementScore,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error calculating value for meme ${memeId}:`, error);
      throw error;
    }
  });

// Helper function to calculate price change based on engagement
function calculatePriceChange(meme: MemeData, newEngagementScore: number): number {
  // Get previous engagement score
  const prevEngagementScore = meme.engagementScore || 10;
  
  // Calculate score change as percentage
  const scoreChangePercent = (newEngagementScore - prevEngagementScore) / prevEngagementScore;
  
  // Apply volatility factor based on meme age
  const ageInDays = (Date.now() - new Date(meme.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const volatilityFactor = Math.max(0.1, 1 - (ageInDays * 0.1)); // Decreases with age
  
  // Apply trade volume factor
  const volumeFactor = Math.min(2, 1 + (meme.tradeVolume / 1000)); // Increases with volume
  
  // Calculate final price change (limited to reasonable bounds)
  const rawPriceChange = scoreChangePercent * volatilityFactor * volumeFactor;
  
  // Limit extreme changes to prevent market manipulation
  return Math.max(-0.3, Math.min(0.3, rawPriceChange));
}

// Update meme valuation (called by scheduler)
export const updateMemeValuation = Devvit.createScheduledFunction('updateMemeValuation',
  async ({ memeId }: { memeId: string }, context): Promise<void> => {
    const { redis, scheduler } = context;
    
    try {
      // Calculate new valuation
      const valuation = await calculateMemeValue({ memeId }, context);
      
      // Get current meme data
      const memeJson = await redis.get(`memes:${memeId}`);
      if (!memeJson) {
        throw new Error(`Meme not found: ${memeId}`);
      }
      
      const meme: MemeData = JSON.parse(memeJson);
      
      // Update meme with new valuation
      meme.currentSharePrice = valuation.currentPrice;
      meme.engagementScore = valuation.engagementScore;
      meme.lastUpdated = valuation.timestamp;
      
      // Add to price history (keep last 24 data points)
      meme.priceHistory.push({
        timestamp: valuation.timestamp,
        price: valuation.currentPrice
      });
      
      // Limit history length
      if (meme.priceHistory.length > 24) {
        meme.priceHistory = meme.priceHistory.slice(meme.priceHistory.length - 24);
      }
      
      // Save updated meme
      await redis.set(`memes:${memeId}`, JSON.stringify(meme));
      
      // Update market history
      await updateMarketHistory(valuation, context);
      
      // Schedule next update (every hour)
      await scheduler.runAfter(3600, 'updateMemeValuation', { memeId });
    } catch (error) {
      console.error(`Error updating valuation for meme ${memeId}:`, error);
      
      // Even if there's an error, reschedule for next update
      await scheduler.runAfter(3600, 'updateMemeValuation', { memeId });
    }
  });

// Get trending memes
export const getTrendingMemes = Devvit.createServerFunction('getTrendingMemes',
  async ({ limit = 10, category = null }: { limit?: number, category?: string | null }, context): Promise<MemeData[]> => {
    const { redis } = context;
    
    try {
      // Determine which index to use
      let memeIdsToFetch: string[] = [];
      
      if (category) {
        // Get memes for specific category
        const categoryIndex = await redis.get(`category:${category}`) || '[]';
        memeIdsToFetch = JSON.parse(categoryIndex);
      } else {
        // Get all memes
        const memeIndex = await redis.get('meme_index') || '[]';
        memeIdsToFetch = JSON.parse(memeIndex);
      }
      
      // Fetch all meme data
      const memes: MemeData[] = [];
      for (const memeId of memeIdsToFetch) {
        const memeJson = await redis.get(`memes:${memeId}`);
        if (memeJson) {
          memes.push(JSON.parse(memeJson));
        }
      }
      
      // Sort by price change (can change to sort by other metrics)
      const sortedMemes = memes.sort((a, b) => {
        // Calculate price change %
        const getChangePercent = (meme: MemeData) => {
          if (meme.priceHistory.length < 2) return 0;
          const current = meme.priceHistory[meme.priceHistory.length - 1].price;
          const previous = meme.priceHistory[meme.priceHistory.length - 2].price;
          return (current - previous) / previous;
        };
        
        return getChangePercent(b) - getChangePercent(a);
      });
      
      // Return limited number
      return sortedMemes.slice(0, limit);
    } catch (error) {
      console.error('Error getting trending memes:', error);
      return [];
    }
  });