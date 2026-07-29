---
title: "GenDeg：先把退化数据造对，再谈统一图像恢复"
date: 2026-07-30T00:00:00+08:00
lastmod: 2026-07-30T00:00:00+08:00
draft: false
description: "GenDeg 不直接改恢复网络，而是用可控扩散模型生成多类型、多强度退化，并构建 GenDS 数据集来提升 All-in-One Image Restoration 的泛化能力。"
summary: "这篇工作的重点不是再设计一个更大的恢复模型，而是把数据问题提到前面：退化类型由文本控制，强度和空间分布由统计量控制，再把合成数据真正用到多个恢复网络上。"
categories: ["Image Restoration"]
tags: ["All-in-One Restoration", "Diffusion", "数据合成", "论文阅读"]
keywords: ["GenDeg", "GenDS", "Degradation Synthesis", "All-in-One Image Restoration", "Diffusion"]
paper_url: "https://arxiv.org/abs/2411.17687"
paper_authors: ["Sudarshan Rajagopalan", "Nithin Gopalakrishnan Nair", "Jay N. Paranjape", "Vishal M. Patel"]
venue: "CVPR 2025"
weight: 1
---

{{< katex >}}

> **论文**：Rajagopalan et al. *GenDeg: Diffusion-based Degradation Synthesis for Generalizable All-In-One Image Restoration*, CVPR 2025。  
> **一句话概括**：与其继续堆恢复网络，不如先用可控扩散模型把训练退化造得更丰富、更接近真实分布。

这篇是我最近几篇里比较喜欢的一篇。它没有继续围绕恢复主干加模块，而是把问题往前推了一步：统一图像恢复泛化不好，未必只是模型不够强，也可能是训练时见过的退化太少、同一场景缺少多种退化配对。这个切入点比单纯再做一次特征融合更直接。

## GenDeg 到底做了什么

GenDeg 基于 InstructPix2Pix 和 Stable Diffusion 的潜扩散框架改造。输入有三类条件：清晰原图负责锁住场景结构；BLIP2 生成的场景描述与退化提示词负责指定“生成什么退化”；退化统计量则进一步控制“退化有多重、分布有多散”。

作者先计算退化图与清晰图的绝对差值：

$$ c_{\mathrm{map}}=\left|x_{\mathrm{in}}-c_{\mathrm{img}}\right|. $$

再用它的均值 \(\mu\) 表示整体退化强度，用标准差 \(\sigma\) 粗略描述空间分布。二者的取值范围各自划分为 128 个区间，编码后与 CLIP 文本特征结合。只用文字描述“大雾”或“雨天”很难控制轻重，而 \(\mu,\sigma\) 给扩散模型增加了一个简单但明确的数值旋钮。我认为这是全文最实在的设计：统计量很粗，却恰好补上了文本条件不擅长表达的部分。

生成图仍可能受 VAE 影响而改变轮廓，所以作者又加了结构校正模块 SCM：

$$ x_S=x_{\mathrm{gen}}+S\!\left([x_{\mathrm{gen}},c_{\mathrm{img}}]\right). $$

它利用清晰图修正生成结果，但并非所有任务都启用。雾、运动模糊和雨滴会使用 SCM；雨、雪、低光没有使用，因为校正网络反而容易抹掉雨丝、雪花这类细碎退化。这个取舍说明作者不是把模块机械地套到所有任务上。

## 数据集可能比模型更重要

作者汇总约 12 万张不同的清晰图，为每张图生成原数据中没有的退化，覆盖雾、雨、雪、运动模糊、低光和雨滴。生成时从真实数据的统计直方图采样 \(\mu\) 与 \(\sigma\)，并以约二十分之一的概率打乱 \(\sigma\)，在真实分布和多样性之间做平衡。经过阈值过滤后得到 55 万余张合成样本，再与已有数据合并成超过 75 万张的 GenDS。

我比较认可它的实验方式：不是只在自研网络上证明有效，而是把 GenDS 分别用于 NAFNet、PromptIR、DA-CLIP、DiffPlugin 等不同路线。这样涨点更容易说明收益来自数据，而不是某个网络恰好适配这套训练。

## 这算不算以前没人做过

不能绝对地说此前没人用扩散模型合成训练数据。图像编辑、物理退化建模、GAN 合成和扩散增广都已有大量工作，InstructPix2Pix 本身也不是新框架。GenDeg 真正新颖的地方，是把“面向 All-in-One Restoration 的退化生成”单独当成问题，并把退化类别、强度和空间分布一起做成可控条件，最后规模化构建同一清晰图对应多种退化的成对数据。

所以我的判断是：它的基础零件并不陌生，但组合方式、问题定义和数据落地都很完整。相比继续在恢复模型内部放一个新模块，这篇工作更像是在修训练分布本身。它也有局限：\(\mu,\sigma\) 只能描述很粗的统计性质，经验阈值过滤不等于真正理解真实退化，合成数据与相机成像链之间仍有域差距。不过它至少证明了一件事——All-in-One Restoration 的下一步，不一定只在模型里，也可能在如何构造更可信的数据。

原论文：[GenDeg (arXiv)](https://arxiv.org/abs/2411.17687)  
数据集：[GenDS](https://huggingface.co/datasets/Sudarshan2002/GenDS)
