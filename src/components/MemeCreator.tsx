import { 
    useState, 
    useCallback 
  } from 'react';
  import {
    Box,
    Button,
    Form,
    Select,
    Text,
    TextInput,
    useForm,
    VStack,
    Image,
    HStack,
    Heading,
    Divider,
    Pill
  } from '@devvit/components';
  import { createMeme } from '../server/memeEngine';
  import { useRedditApi } from '@devvit/hooks';
  
  // Sample templates to get started
  const MEME_TEMPLATES = [
    { id: 'drake', name: 'Drake Hotline Bling', imageUrl: 'https://i.imgur.com/dZLQxdu.png' },
    { id: 'distracted', name: 'Distracted Boyfriend', imageUrl: 'https://i.imgur.com/tpLdFRn.png' },
    { id: 'button', name: 'Two Buttons', imageUrl: 'https://i.imgur.com/sYkuXlX.png' },
    { id: 'change', name: "Change My Mind", imageUrl: 'https://i.imgur.com/tKDx1uo.jpeg' },
    { id: 'custom', name: '✨ Upload Custom Template', imageUrl: '' }
  ];
  
  // Categories to tag memes
  const MEME_CATEGORIES = [
    { value: 'reaction', label: 'Reaction' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'politics', label: 'Politics' },
    { value: 'movies', label: 'Movies/TV' },
    { value: 'animals', label: 'Animals' },
    { value: 'tech', label: 'Tech' },
    { value: 'sports', label: 'Sports' },
  ];
  
  export default function MemeCreator({ onMemeCreated }) {
    const reddit = useRedditApi();
    const [selectedTemplate, setSelectedTemplate] = useState(MEME_TEMPLATES[0]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [customTemplateUrl, setCustomTemplateUrl] = useState('');
    
    const form = useForm({
      title: '',
      topText: '',
      bottomText: '',
      initialSharePrice: '10',
      categories: []
    });
  
    const handleTemplateChange = useCallback((templateId) => {
      const template = MEME_TEMPLATES.find(t => t.id === templateId);
      setSelectedTemplate(template);
    }, []);
  
    const handleCategoryChange = useCallback((category) => {
      setSelectedCategories(prev => {
        if (prev.includes(category)) {
          return prev.filter(c => c !== category);
        } else {
          return [...prev, category];
        }
      });
    }, []);
  
    const handleCustomUpload = useCallback(async () => {
      // In a real implementation, this would integrate with Reddit's image upload API
      // For hackathon purposes, we can simulate with a placeholder
      setIsUploading(true);
      
      try {
        // Simplified for demo - would use reddit.uploadMedia() in production
        setTimeout(() => {
          setCustomTemplateUrl('https://i.imgur.com/placeholder.png');
          setIsUploading(false);
        }, 1500);
      } catch (error) {
        console.error("Error uploading image:", error);
        setIsUploading(false);
      }
    }, []);
  
    const handleSubmit = useCallback(async (data) => {
      try {
        const memeData = {
          ...data,
          templateId: selectedTemplate.id,
          templateUrl: selectedTemplate.id === 'custom' ? customTemplateUrl : selectedTemplate.imageUrl,
          createdAt: new Date().toISOString(),
          categories: selectedCategories,
          initialSharePrice: parseFloat(data.initialSharePrice)
        };
        
        // Call server function to create the meme
        const newMeme = await createMeme(memeData);
        
        if (onMemeCreated) {
          onMemeCreated(newMeme);
        }
        
        // Reset form
        form.reset();
        setSelectedCategories([]);
        setSelectedTemplate(MEME_TEMPLATES[0]);
        setCustomTemplateUrl('');
        
      } catch (error) {
        console.error("Error creating meme:", error);
      }
    }, [selectedTemplate, customTemplateUrl, selectedCategories, onMemeCreated, form]);
  
    return (
      <Box padding="medium">
        <Heading level="2">Meme Creator Studio</Heading>
        <Text color="secondary">Launch your meme IPO on the MemeTycoon marketplace!</Text>
        <Divider />
        
        <Form onSubmit={handleSubmit} form={form}>
          <VStack gap="medium">
            <Box>
              <Text weight="bold">1. Choose a template</Text>
              <Select
                name="templateId"
                options={MEME_TEMPLATES.map(template => ({
                  value: template.id,
                  label: template.name
                }))}
                onChange={handleTemplateChange}
              />
              
              {selectedTemplate.id === 'custom' && (
                <VStack gap="small" padding="small">
                  <Button 
                    variant="secondary" 
                    onPress={handleCustomUpload}
                    loading={isUploading}
                  >
                    Upload Custom Template
                  </Button>
                  {customTemplateUrl && (
                    <Image src={customTemplateUrl} aspectRatio={16/9} />
                  )}
                </VStack>
              )}
              
              {selectedTemplate.id !== 'custom' && selectedTemplate.imageUrl && (
                <Box padding="small">
                  <Image src={selectedTemplate.imageUrl} aspectRatio={16/9} />
                </Box>
              )}
            </Box>
            
            <Box>
              <Text weight="bold">2. Add your text</Text>
              <VStack gap="small">
                <TextInput
                  name="title"
                  label="Meme Title"
                  placeholder="Give your meme a catchy name"
                  required
                />
                <TextInput
                  name="topText"
                  label="Top Text"
                  placeholder="Text for the top of the meme"
                />
                <TextInput
                  name="bottomText"
                  label="Bottom Text"
                  placeholder="Text for the bottom of the meme"
                />
              </VStack>
            </Box>
            
            <Box>
              <Text weight="bold">3. Set categories</Text>
              <HStack gap="small" wrap="wrap">
                {MEME_CATEGORIES.map(category => (
                  <Pill
                    key={category.value}
                    variant={selectedCategories.includes(category.value) ? "primary" : "secondary"}
                    onPress={() => handleCategoryChange(category.value)}
                  >
                    {category.label}
                  </Pill>
                ))}
              </HStack>
            </Box>
            
            <Box>
              <Text weight="bold">4. Set initial share price</Text>
              <TextInput
                name="initialSharePrice"
                label="Initial Price (₽)"
                defaultValue="10"
                type="number"
                min="1"
                max="100"
                required
              />
              <Text size="small" color="secondary">
                Set between 1-100 MemeCoins (₽). Higher values indicate higher confidence!
              </Text>
            </Box>
            
            <Button type="submit" variant="primary" size="large">
              Launch Meme IPO
            </Button>
          </VStack>
        </Form>
      </Box>
    );
  }