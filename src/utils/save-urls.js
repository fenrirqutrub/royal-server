export const savePhotoUrls = async (req, res) => {
  try {
    const { images } = req.body;

    if (!images?.length) {
      return res.status(400).json({ message: "No images provided" });
    }

    const saved = await Promise.all(
      images.map((img) =>
        Photography.create({
          imageUrl: img.imageUrl,
          publicId: img.publicId,
          title: img.publicId.split("/").pop(),
          width: img.width,
          height: img.height,
          format: img.format,
          size: img.size,
          views: 0,
        }),
      ),
    );

    res.status(201).json({
      message: `Successfully saved ${saved.length} photo(s)`,
      data: saved,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to save", error: err.message });
  }
};
