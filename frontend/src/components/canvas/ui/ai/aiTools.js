/**
 * Tool definitions for the AI Assistant.
 * These follow the JSON schema format used by Gemini, OpenAI, and Groq.
 */
export const getBaseSchema = () => [
    {
        name: "create_shape",
        description: "Creates a geometric shape (rect, ellipse, triangle). Supports internal text.",
        parameters: {
            type: "object",
            properties: {
                shapeType: { type: "string", enum: ["rect", "ellipse", "triangle"] },
                width: { type: "number" },
                height: { type: "number" },
                text: { type: "string", description: "Text to show inside" },
                textColor: { type: "string", description: "Color of the text (e.g. #ffffff)" },
                x: { type: "number" },
                y: { type: "number" },
                color: { type: "string", description: "Border color" },
                fill: { type: "string", description: "Fill color" }
            },
            required: ["shapeType"]
        }
    },
    {
        name: "create_sticky",
        description: "Creates a classic sticky note for brainstorming.",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string" },
                color: { type: "string", description: "Optional background color hex" },
                x: { type: "number" },
                y: { type: "number" }
            },
            required: ["text"]
        }
    },
    {
        name: "create_text",
        description: "Creates a standalone text box.",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string" },
                fontSize: { type: "number" },
                x: { type: "number" },
                y: { type: "number" }
            },
            required: ["text"]
        }
    },
    {
        name: "create_arrow",
        description: "Draws an arrow between points or as a standalone element.",
        parameters: {
            type: "object",
            properties: {
                x: { type: "number" },
                y: { type: "number" },
                w: { type: "number", description: "Length of the arrow" },
                rotation: { type: "number", description: "Angle in degrees" },
                color: { type: "string" }
            }
        }
    },
    {
        name: "create_mermaid",
        description: "Creates a mermaid.js flowchart or diagram.",
        parameters: {
            type: "object",
            properties: {
                code: { type: "string", description: "The raw mermaid.js code block" },
                x: { type: "number" },
                y: { type: "number" }
            },
            required: ["code"]
        }
    },
    {
        name: "create_video",
        description: "Embeds a YouTube or direct video link.",
        parameters: {
            type: "object",
            properties: {
                url: { type: "string", description: "The video URL" },
                x: { type: "number" },
                y: { type: "number" }
            },
            required: ["url"]
        }
    },
    {
        name: "create_code",
        description: "Creates an interactive code terminal.",
        parameters: {
            type: "object",
            properties: {
                code: { type: "string", description: "The source code" },
                language: { type: "string" },
                x: { type: "number" },
                y: { type: "number" }
            },
            required: ["code", "language"]
        }
    },
    {
        name: "delete_elements",
        description: "Deletes existing elements from the board.",
        parameters: {
            type: "object",
            properties: {
                elementIds: { type: "array", items: { type: "string" } }
            },
            required: ["elementIds"]
        }
    },
    {
        name: "update_elements",
        description: "Updates properties of existing elements (color, size, text, location, rotation, font).",
        parameters: {
            type: "object",
            properties: {
                updates: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            x: { type: "number" },
                            y: { type: "number" },
                            w: { type: "number" },
                            h: { type: "number" },
                            rotation: { type: "number" },
                            stroke: { type: "string" },
                            fill: { type: "string" },
                            text: { type: "string" },
                            expressions: { type: "array", items: { type: "object" } },
                            code: { type: "string" },
                            fontSize: { type: "number" },
                            fontFamily: { type: "string" },
                            textAlign: { type: "string", enum: ["left", "center", "right"] }
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
            type: "object",
            properties: {
                x: { type: "number" },
                y: { type: "number" },
                w: { type: "number", description: "Length" },
                rotation: { type: "number" },
                color: { type: "string" }
            }
        }
    },
    {
        name: "create_graph",
        description: "Creates a mathematical coordinate plane with function plots. Can plot multiple functions at once.",
        parameters: {
            type: "object",
            properties: {
                expressions: { type: "array", items: { type: "string" } },
                x: { type: "number" },
                y: { type: "number" }
            },
            required: ["expressions"]
        }
    }
];
