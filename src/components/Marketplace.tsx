import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Divider,
  Button,
  Tabs,
  Tab,
  Image,
  Pill,
  Spinner,
  Card
} from '@devvit/components';
import { getTrendingMemes } from '../server/memeEngine';
import { MemeData } from '../storage/memeRegistry';
import { TradingModal } from './Trading';
import { useRedditApi } from '@devvit/hooks';

// Categories for filtering
const CATEGORIES = [
  { id: 'all', label: 'All Memes' },
  { id: 'trending', label: '🔥 Trending' },
  { id: 'new', label: '🆕 New IPOs' },
  { id: 'reaction', label: 'Reaction' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'politics', label: 'Politics' },
  { id: 'movies', label: 'Movies/TV' },
  { id: 'animals', label: 'Animals' },
  { id: 'tech', label: 'Tech' },
  { id: 'sports', label: 'Sports' },
];

export default function Marketplace() {
  const [memes, setMemes] = useState<MemeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [selectedMeme, setSelectedMeme] = useState<MemeData | null>(null);
  const [showTradingModal, setShowTradingModal] = useState(false);
  
  const reddit = useRedditApi();
  
  // Load memes
  const loadMemes = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch memes based on category and sort
      const category = selectedCategory !== 'all' ? selectedCategory : null;
      const memeData = await getTrendingMemes({ limit: 20, category });
      
      // Apply sorting
      let sortedMemes = [...memeData];
      
      if (sortBy === 'trending') {
        // Already sorted by trending in the server function
      } else if (sortBy === 'new') {
        sortedMemes.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else if (sortBy === 'price-high') {
        sortedMemes.sort((a, b) => b.currentSharePrice - a.currentSharePrice);
      } else if (sortBy === 'price-low') {
        sortedMemes.sort((a, b) => a.currentSharePrice - b.currentSharePrice);
      } else if (sortBy === 'volume') {
        sortedMemes.sort((a, b) => b.tradeVolume - a.tradeVolume);
      }
      
      setMemes(sortedMemes);
    } catch (error) {
      console.error('Error loading memes:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortBy]);
  
  useEffect(() => {
    loadMemes();
    
    // Set up refresh interval (every 30 seconds)
    const interval = setInterval(loadMemes, 30000);
    
    return () => clearInterval(interval);
  }, [loadMemes]);
  
  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);
  
  const handleSortChange = useCallback((sort: string) => {
    setSortBy(sort);
  }, []);
  
  const handleTradePress = useCallback((meme: MemeData) => {
    setSelectedMeme(meme);
    setShowTradingModal(true);
  }, []);
  
  const handleCloseTrading = useCallback(() => {
    setShowTradingModal(false);
    // Refresh data after trading
    loadMemes();
  }, [loadMemes]);
  
  const getPriceChangeClass = useCallback((meme: MemeData) => {
    if (meme.priceHistory.length < 2) return 'neutral';
    
    const current = meme.priceHistory[meme.priceHistory.length - 1].price;
    const previous = meme.priceHistory[meme.priceHistory.length - 2].price;
    const change = current - previous;
    
    return change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
  }, []);
  
  const formatPriceChange = useCallback((meme: MemeData) => {
    if (meme.priceHistory.length < 2) return '+0.00%';
    
    const current = meme.priceHistory[meme.priceHistory.length - 1].price;
    const previous = meme.priceHistory[meme.priceHistory.length - 2].price;
    const changePercent = ((current - previous) / previous) * 100;
    
    const prefix = changePercent > 0 ? '+' : '';
    return `${prefix}${changePercent.toFixed(2)}%`;
  }, []);

  return (
    <Box padding="medium">
      <Heading level="2">Meme Marketplace</Heading>
      <Text color="secondary">Buy, sell, and trade shares in the hottest memes!</Text>
      <Divider />
      
      {/* Category filters */}
      <Box marginY="medium">
        <HStack gap="small" wrap="wrap">
          {CATEGORIES.map(category => (
            <Pill
              key={category.id}
              variant={selectedCategory === category.id ? "primary" : "secondary"}
              onPress={() => handleCategoryChange(category.id)}
            >
              {category.label}
            </Pill>
          ))}
        </HStack>
      </Box>
      
      {/* Sorting options */}
      <Box marginY="medium">
        <Tabs
          value={sortBy}
          onChange={value => handleSortChange(value as string)}
        >
          <Tab value="trending" label="Trending" />
          <Tab value="new" label="Newest" />
          <Tab value="price-high" label="Price (High)" />
          <Tab value="price-low" label="Price (Low)" />
          <Tab value="volume" label="Volume" />
        </Tabs>
      </Box>
      
      {/* Meme listings */}
      {loading ? (
        <Box height="200px" display="flex" alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Box>
      ) : memes.length === 0 ? (
        <Box padding="large" display="flex" alignItems="center" justifyContent="center">
          <Text>No memes found for this category</Text>
        </Box>
      ) : (
        <VStack gap="medium">
          {memes.map(meme => (
            <Card key={meme.id}>
              <HStack gap="medium" alignItems="stretch">
                {/* Meme preview */}
                <Box width="120px" height="120px">
                  <Image 
                    src={meme.templateUrl} 
                    aspectRatio={1}
                    borderRadius="medium"
                  />
                </Box>
                
                {/* Meme details */}
                <VStack flex={1} gap="xsmall" justifyContent="space-between">
                  <HStack justifyContent="space-between" alignItems="flex-start">
                    <Heading level="3">{meme.title}</Heading>
                    <HStack gap="xsmall">
                      {meme.categories.map(cat => (
                        <Pill key={cat} size="small">{cat}</Pill>
                      ))}
                    </HStack>
                  </HStack>
                  
                  <Text size="small" color="secondary">
                    Created by u/{meme.creatorName}
                  </Text>
                  
                  <HStack justifyContent="space-between" alignItems="center">
                    <HStack gap="small">
                      <Text weight="bold">₽{meme.currentSharePrice.toFixed(2)}</Text>
                      <Text 
                        className={getPriceChangeClass(meme)}
                        color={getPriceChangeClass(meme) === 'positive' ? 'green' : 
                               getPriceChangeClass(meme) === 'negative' ? 'red' : 'secondary'}
                      >
                        {formatPriceChange(meme)}
                      </Text>
                    </HStack>
                    
                    <Text size="small">
                      Available: {meme.availableShares}/{meme.totalShares} shares
                    </Text>
                  </HStack>
                </VStack>
                
                {/* Actions */}
                <VStack justifyContent="center" gap="small">
                  <Button
                    variant="primary"
                    onPress={() => handleTradePress(meme)}
                  >
                    Trade
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      // Navigate to meme detail page (would be implemented in full app)
                      console.log(`View details for ${meme.id}`);
                    }}
                  >
                    Details
                  </Button>
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      )}
      
      {/* Trading modal */}
      {showTradingModal && selectedMeme && (
        <TradingModal
          meme={selectedMeme}
          onClose={handleCloseTrading}
        />
      )}
    </Box>
  );
}