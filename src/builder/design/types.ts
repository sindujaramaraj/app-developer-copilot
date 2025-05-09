// Define the expected output schema
export interface DesignSchema {
  analysis_id: string;
  input_images_count: number;
  image_summaries?: Array<{
    // Optional: Summary for each image
    image_index: number;
    description: string; // Brief description of what this specific screen/image shows
  }>;
  design_elements: {
    layout: {
      type: string; // e.g., grid, list, single-column
      description: string; // Overall layout description
    };
    color_palette: Array<{
      // Common color palette
      hex: string;
      role: string; // e.g., primary, secondary, accent, background, text
    }>;
    typography: Array<{
      // Common typography rules
      font_family: string;
      size: string;
      weight: string;
      role: string; // e.g., heading1, body, caption, button
    }>;
    components: Array<{
      // Common or significant components across images
      type: string; // e.g., button, card, input-field, navigation-bar, image-carousel
      description: string; // Description of the component's appearance and typical use
      // position?: { x: number; y: number }; // Position might be less relevant for common components
      instances: number; // How many times this component appears across images (approx)
    }>;
    overall_style: string; // e.g., minimalist, modern, playful, corporate, brutalist
  };
  common_elements_summary?: string; // Text summary of recurring patterns, styles, or components
  user_flow?: {
    // Optional: Describe the flow if images represent a sequence
    description: string; // Text description of the likely user journey across the screens
    steps: Array<{
      // Ordered steps in the flow
      image_index: number;
      action: string; // What the user does or sees on this screen in the flow
    }>;
  };
}
