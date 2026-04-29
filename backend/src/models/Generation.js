const mongoose = require('mongoose');

const contentPackageSchema = new mongoose.Schema(
  {
    socialCaption: {
      type: String,
      default: '',
    },
    hashtagSuggestions: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const generationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [140, 'Title cannot exceed 140 characters'],
      default: '',
    },
    productDescription: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [1200, 'Product description cannot exceed 1200 characters'],
    },
    keywords: {
      type: [String],
      default: [],
    },
    style: {
      type: String,
      trim: true,
      maxlength: [120, 'Style cannot exceed 120 characters'],
      required: [true, 'Style is required'],
    },
    platform: {
      type: String,
      trim: true,
      maxlength: [80, 'Platform cannot exceed 80 characters'],
      required: [true, 'Platform is required'],
    },
    objective: {
      type: String,
      trim: true,
      maxlength: [240, 'Objective cannot exceed 240 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['generated', 'rendering', 'completed', 'failed'],
      default: 'generated',
    },
    outputs: {
      caption: {
        type: String,
        default: '',
      },
      hashtags: {
        type: [String],
        default: [],
      },
      voiceoverScript: {
        type: String,
        default: '',
      },
      onScreenText: {
        type: [String],
        default: [],
      },
      visualDirection: {
        type: String,
        default: '',
      },
      contentPackage: {
        type: contentPackageSchema,
        default: () => ({}),
      },
      mediaKeywords: {
        type: [String],
        default: [],
      },
      callToAction: {
        type: String,
        default: '',
      },
    },
    assets: {
      previewUrl: {
        type: String,
        default: '',
      },
      audioUrl: {
        type: String,
        default: '',
      },
      videoUrl: {
        type: String,
        default: '',
      },
    },
    voice: {
      provider: {
        type: String,
        default: 'deepgram',
      },
      configured: {
        type: Boolean,
        default: false,
      },
      voiceId: {
        type: String,
        default: '',
      },
      generatedAt: Date,
      errorMessage: {
        type: String,
        default: '',
      },
    },
    render: {
      configured: {
        type: Boolean,
        default: false,
      },
      renderedAt: Date,
      sourceType: {
        type: String,
        default: '',
      },
      errorMessage: {
        type: String,
        default: '',
      },
    },
    media: {
      provider: {
        type: String,
        default: 'pexels',
      },
      query: {
        type: String,
        default: '',
      },
      configured: {
        type: Boolean,
        default: false,
      },
      fetchedAt: Date,
      errorMessage: {
        type: String,
        default: '',
      },
      photos: {
        type: [
          {
            externalId: Number,
            url: String,
            thumbnailUrl: String,
            photographer: String,
            alt: String,
            width: Number,
            height: Number,
          },
        ],
        default: [],
      },
      videos: {
        type: [
          {
            externalId: Number,
            url: String,
            thumbnailUrl: String,
            duration: Number,
            width: Number,
            height: Number,
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

generationSchema.index({ owner: 1, createdAt: -1 });
generationSchema.index({ owner: 1, platform: 1, status: 1 });

module.exports = mongoose.model('Generation', generationSchema);
