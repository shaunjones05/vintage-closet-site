from PIL import Image, ImageDraw, ImageFont

# Create a simple logo image
width, height = 300, 300
bg_color = (246, 241, 234)  # warm paper color
text_color = (176, 133, 91)  # vintage accent brown

# Create image
img = Image.new('RGB', (width, height), bg_color)
draw = ImageDraw.Draw(img)

# Add text 'VC' for Vintage Closet
try:
    font = ImageFont.truetype('C:\\Windows\\Fonts\\georgia.ttf', 120)
except:
    font = ImageFont.load_default()

# Center text
bbox = draw.textbbox((0, 0), 'VC', font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (width - text_width) // 2
y = (height - text_height) // 2

draw.text((x, y), 'VC', fill=text_color, font=font)

# Save
img.save('images/logo.jpg')
print('Logo created at images/logo.jpg')
