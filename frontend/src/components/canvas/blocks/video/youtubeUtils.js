export function getYouTubeId(url) {
    if (!url) return "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : "";
}

export function getYouTubeEmbedUrl(videoId) {
    if (!videoId) return "";
    return `https://www.youtube.com/embed/${videoId}`;
}
