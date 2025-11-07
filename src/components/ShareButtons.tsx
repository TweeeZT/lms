"use client";

import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconBrandFacebook,
  IconBrandTwitter,
  IconBrandWhatsapp,
  IconLink,
  IconShare,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

interface ShareButtonsProps {
  title: string;
  description?: string;
  courseId: string;
  affiliateCode?: string; // Optional affiliate code from user's profile
  compact?: boolean; // If true, show smaller buttons
}

export default function ShareButtons({
  title,
  description,
  courseId,
  affiliateCode,
  compact = false,
}: ShareButtonsProps) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const courseUrl = `${baseUrl}/user/courses/${courseId}`;
  const shareUrl = affiliateCode
    ? `${courseUrl}?ref=${affiliateCode}`
    : courseUrl;

  const shareText = description ? `${title} - ${description}` : title;

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}`;
    window.open(facebookUrl, "_blank", "width=600,height=400");
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      `${shareText} ${shareUrl}`
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      notifications.show({
        color: "green",
        title: "Berhasil!",
        message: "Link berhasil disalin ke clipboard",
        icon: <IconLink size={18} />,
      });
    } catch (err) {
      notifications.show({
        color: "red",
        message: "Gagal menyalin link",
      });
    }
  };

  const iconSize = compact ? 18 : 20;
  const buttonSize = compact ? "sm" : "md";

  return (
    <Group gap={compact ? 6 : 8}>
      <Tooltip label="Share ke Facebook" position="top">
        <ActionIcon
          variant="light"
          color="blue"
          size={buttonSize}
          onClick={handleFacebookShare}
        >
          <IconBrandFacebook size={iconSize} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Share ke Twitter" position="top">
        <ActionIcon
          variant="light"
          color="cyan"
          size={buttonSize}
          onClick={handleTwitterShare}
        >
          <IconBrandTwitter size={iconSize} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Share ke WhatsApp" position="top">
        <ActionIcon
          variant="light"
          color="green"
          size={buttonSize}
          onClick={handleWhatsAppShare}
        >
          <IconBrandWhatsapp size={iconSize} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Salin Link" position="top">
        <ActionIcon
          variant="light"
          color="gray"
          size={buttonSize}
          onClick={handleCopyLink}
        >
          <IconLink size={iconSize} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
