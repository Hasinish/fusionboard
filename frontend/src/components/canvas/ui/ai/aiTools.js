/**
 * Tool definitions for the AI Assistant.
 * These follow the JSON schema format used by Gemini, OpenAI, and Groq.
 */
export const getBaseSchema = () => [
    {
        name: "create_shape",
        description: "Creates a geometric shape (rect, ellipse, triangle). Supports internal text.",
        parameters: {
            type: "OBJECT",
            properties: {
                shapeType: { type: "STRING", enum: ["rect", "ellipse", "triangle"] },
                width: { type: "NUMBER" },
                height: { type: "NUMBER" },
                text: { type: "STRING", description: "Text to show inside" },
                textColor: { type: "STRING", description: "Color of the text (e.g. #ffffff)" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" },
                color: { type: "STRING", description: "Border color" },
                fill: { type: "STRING", description: "Fill color" }
            },
            required: ["shapeType"]
        }
    },
    {
        name: "create_sticky",
        description: "Creates a classic sticky note for brainstorming.",
        parameters: {
            type: "OBJECT",
            properties: {
                text: { type: "STRING" },
                color: { type: "STRING", description: "Optional background color hex" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
            },
            required: ["text"]
        }
    },
    {
        name: "create_text",
        description: "Creates a standalone text box.",
        parameters: {
            type: "OBJECT",
            properties: {
                text: { type: "STRING" },
                fontSize: { type: "NUMBER" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
            },
            required: ["text"]
        }
    },
    {
        name: "create_arrow",
        description: "Draws an arrow between points or as a standalone element.",
        parameters: {
            type: "OBJECT",
            properties: {
                x: { type: "NUMBER" },
                y: { type: "NUMBER" },
                w: { type: "NUMBER", description: "Length of the arrow" },
                rotation: { type: "NUMBER", description: "Angle in degrees" },
                color: { type: "STRING" }
            }
        }
    },
    {
        name: "create_mermaid",
        description: "Creates a mermaid.js flowchart or diagram.",
        parameters: {
            type: "OBJECT",
            properties: {
                code: { type: "STRING", description: "The raw mermaid.js code block" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
            },
            required: ["code"]
        }
    },
    {
        name: "create_video",
        description: "Embeds a YouTube or direct video link.",
        parameters: {
            type: "OBJECT",
            properties: {
                url: { type: "STRING", description: "The video URL" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
            },
            required: ["url"]
        }
    },
    {
        name: "create_code",
        description: "Creates an interactive code terminal.",
        parameters: {
            type: "OBJECT",
            properties: {
                code: { type: "STRING", description: "The source code" },
                language: { type: "STRING" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
            },
            required: ["code", "language"]
        }
    },
    {
        name: "delete_elements",
        description: "Deletes existing elements from the board.",
        parameters: {
            type: "OBJECT",
            properties: {
                elementIds: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["elementIds"]
        }
    },
    {
        name: "update_elements",
        description: "Updates properties of existing elements (color, size, text, location, rotation, font).",
        parameters: {
            type: "OBJECT",
            properties: {
                updates: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            id: { type: "STRING" },
                            x: { type: "NUMBER" },
                            y: { type: "NUMBER" },
                            w: { type: "NUMBER" },
                            h: { type: "NUMBER" },
                            rotation: { type: "NUMBER" },
                            stroke: { type: "STRING" },
                            fill: { type: "STRING" },
                            text: { type: "STRING" },
                            expressions: { type: "ARRAY", items: { type: "OBJECT" } },
                            code: { type: "STRING" },
                            fontSize: { type: "NUMBER" },
                            fontFamily: { type: "STRING" },
                            textAlign: { type: "STRING", enum: ["left", "center", "right"] }
                        },
                        required: ["id"]
                    }
                }
            },
            required: ["updates"]
        }
    },
    {
        name: "create_line",
        description: "Draws a straight line.",
        parameters: {
            type: "OBJECT",
            properties: {
                x: { type: "NUMBER" },
                y: { type: "NUMBER" },
                w: { type: "NUMBER", description: "Length" },
                rotation: { type: "NUMBER" },
                color: { type: "STRING" }
            }
        }
    },
    {
        name: "create_graph",
        description: "Creates a mathematical coordinate plane with function plots. Can plot multiple functions at once.",
        parameters: {
            type: "OBJECT",
            properties: {
                expressions: { type: "ARRAY", items: { type: "STRING" } },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
            },
            required: ["expressions"]
        }
    }
];
